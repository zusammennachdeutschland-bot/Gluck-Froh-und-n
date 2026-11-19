import {
  GoogleAuthProvider,
  UserCredential,
  linkWithPopup,
  linkWithRedirect,
  onAuthStateChanged,
  reauthenticateWithPopup,
  reauthenticateWithRedirect,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';
import { auth, consumeFirebaseWebRedirectResultOnce } from '../shared/firebaseCloudSync';
import {
  invokeNativeClearCalendarToken,
  invokeNativeGoogleCalendarAuthorize,
  invokeNativeRevokeCalendarAccess,
  isAndroidNativePlatform
} from '../shared/googleCredentialAuthPlugin';
import { GroupWeeklySession } from '../types';
import {
  DEFAULT_ZOOM_TIMEZONE,
  computeNextSessionStartWallTime,
  deriveDeterministicGoogleEventId,
  generateStableCalendarUid,
  toRRuleByDay
} from './zoomSessionStandardizer';

export interface CalendarSyncPreviewItem {
  sessionId: string;
  sessionCode: string;
  standardizedTitle: string;
  calendarEventUid: string;
  deterministicGoogleEventId: string;
  googleCalendarEventId?: string;
  googleCalendarIcalUid?: string;
  weekdayName: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  recurrence: GroupWeeklySession['recurrence'];
  zoomJoinUrl?: string;
  action: 'create' | 'update' | 'delete' | 'skip_synced';
}

export interface CalendarSyncResult {
  success: boolean;
  authExpired?: boolean;
  scopeInsufficient?: boolean;
  rateLimited?: boolean;
  errorCode?: string;
  createdCount: number;
  updatedCount: number;
  deletedCount?: number;
  skippedCount: number;
  failedCount: number;
  sessions: GroupWeeklySession[];
  errors: Array<{ sessionId: string; title: string; error: string; status?: number; code?: string }>;
}

export type CalendarOAuthStage =
  | 'calendar_oauth_start'
  | 'calendar_oauth_memory_cache_hit'
  | 'calendar_oauth_android_native_invoke'
  | 'calendar_oauth_android_native_cancelled'
  | 'calendar_oauth_android_native_resolution_required'
  | 'calendar_oauth_android_native_token_received'
  | 'calendar_oauth_android_stale_token_cleared'
  | 'calendar_oauth_web_popup_start'
  | 'calendar_oauth_web_popup_fallback_redirect'
  | 'calendar_oauth_web_redirect_result_check'
  | 'calendar_oauth_web_redirect_result_processed'
  | 'calendar_oauth_verify_calendar_start'
  | 'calendar_oauth_verify_calendar_ok'
  | 'calendar_oauth_verify_calendar_failed'
  | 'calendar_oauth_write_verified'
  | 'calendar_oauth_write_permission_denied'
  | 'calendar_oauth_deeplink_callback'
  | 'calendar_oauth_auth_state_cleared'
  | 'calendar_oauth_disconnected'
  | 'calendar_oauth_error';

export interface CalendarOAuthDiagnosticEvent {
  timestampIso: string;
  stage: CalendarOAuthStage;
  platform: 'android_native' | 'web';
  ok?: boolean;
  code?: string;
  detail?: string;
}

export type GoogleCalendarConnectionStatus =
  | 'disconnected'
  | 'needs_verification'
  | 'reconnect_required'
  | 'connected'
  | 'cancelled'
  | 'expired'
  | 'error'
  | 'pending_redirect';

export interface GoogleCalendarConnectionState {
  status: GoogleCalendarConnectionStatus;
  accountEmail?: string;
  firebaseOwnerEmail?: string;
  calendarId?: string;
  calendarSummary?: string;
  calendarTimeZone?: string;
  calendarAccessRole?: string;
  scopeVerified: boolean;
  readVerified: boolean;
  writeVerified: boolean;
  hasInMemoryToken: boolean;
  platform: 'android_native' | 'web';
  lastVerifiedAtIso?: string;
  lastMessage?: string;
  lastErrorCode?: string;
}

export interface GoogleCalendarTokenResult {
  ok: boolean;
  accessToken?: string;
  accountEmail?: string;
  calendarSummary?: string;
  scopeVerified?: boolean;
  readVerified?: boolean;
  writeVerified?: boolean;
  cancelled?: boolean;
  resolutionRequired?: boolean;
  redirected?: boolean;
  expired?: boolean;
  retryAfterClearToken?: boolean;
  platform?: 'android_native' | 'web';
  error?: string;
  code?: string;
}

export interface WebCalendarRedirectStartupResult {
  handled: boolean;
  ok: boolean;
  shouldOpenIntegrations: boolean;
  accountEmail?: string;
  message?: string;
}

export interface CalendarDeepLinkCallbackResult {
  matched: boolean;
  alreadyHandled: boolean;
  shouldOpenIntegrations: boolean;
  status: 'connected' | 'cancelled' | 'error' | 'open_integrations';
  message?: string;
}

export interface WebCalendarAuthTestAdapter {
  popupAuthorize?: (params: {
    forcePrompt: boolean;
    scope: string;
  }) => Promise<{ accessToken?: string; email?: string }>;
  redirectAuthorize?: (params: {
    forcePrompt: boolean;
    scope: string;
  }) => Promise<void>;
  consumeRedirectResult?: () => Promise<{ accessToken?: string; email?: string } | null>;
}

const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const CALENDAR_CONNECTION_META_STORAGE_KEY = 'glueck_google_calendar_connection_meta_v1';
const PENDING_WEB_CALENDAR_REDIRECT_KEY = 'glueck_pending_web_calendar_redirect_v1';
const MAX_DIAGNOSTIC_EVENTS = 40;

// Strictly in-memory Google Calendar OAuth token (NEVER written to localStorage/sessionStorage/IndexedDB)
let inMemoryGoogleCalendarAccessToken: string | null = null;
let inMemoryTokenExpiresAtMs = 0;
let inMemoryTokenAccountEmail: string | null = null;
let lastInvalidatedAccessToken: string | null = null;
let inFlightCalendarAuthPromise: Promise<GoogleCalendarTokenResult> | null = null;

// Single-shot guards for startup redirect processing and deep-link callbacks
let webRedirectProcessingPromise: Promise<WebCalendarRedirectStartupResult> | null = null;
const handledCalendarDeepLinkKeys = new Set<string>();

// Safe in-memory diagnostic ring buffer (zero secrets/tokens/codes)
const calendarOAuthDiagnostics: CalendarOAuthDiagnosticEvent[] = [];

// Connection state listeners
type ConnectionStateListener = (state: GoogleCalendarConnectionState) => void;
const connectionStateListeners = new Set<ConnectionStateListener>();

export type CalendarFetchFn = typeof fetch;
let customCalendarFetchForTesting: CalendarFetchFn | null = null;
let webCalendarAuthTestAdapter: WebCalendarAuthTestAdapter | null = null;

function sanitizeDiagnosticText(value?: string): string | undefined {
  if (!value) return undefined;
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]')
    .replace(/ya29\.[A-Za-z0-9\-._~+/]+/g, '[REDACTED_TOKEN]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED_JWT]')
    .replace(/(access_token|refresh_token|id_token|code|token|secret)=([^&\s]+)/gi, '$1=[REDACTED]')
    .slice(0, 220);
}

function getCurrentPlatformTag(): 'android_native' | 'web' {
  return isAndroidNativePlatform() ? 'android_native' : 'web';
}

function recordCalendarOAuthStage(
  stage: CalendarOAuthStage,
  info: { ok?: boolean; code?: string; detail?: string } = {}
): void {
  const event: CalendarOAuthDiagnosticEvent = {
    timestampIso: new Date().toISOString(),
    stage,
    platform: getCurrentPlatformTag(),
    ...(typeof info.ok === 'boolean' ? { ok: info.ok } : {}),
    ...(info.code ? { code: sanitizeDiagnosticText(info.code) } : {}),
    ...(info.detail ? { detail: sanitizeDiagnosticText(info.detail) } : {})
  };
  calendarOAuthDiagnostics.push(event);
  if (calendarOAuthDiagnostics.length > MAX_DIAGNOSTIC_EVENTS) {
    calendarOAuthDiagnostics.shift();
  }
  const summary = `[Glück CalendarOAuth] stage=${event.stage} platform=${event.platform}${
    event.code ? ` code=${event.code}` : ''
  }${typeof event.ok === 'boolean' ? ` ok=${event.ok}` : ''}${
    event.detail ? ` detail="${event.detail}"` : ''
  }`;
  if (event.ok === false || stage === 'calendar_oauth_error') {
    console.warn(summary);
  } else {
    console.info(summary);
  }
}

export function getCalendarOAuthDiagnostics(): CalendarOAuthDiagnosticEvent[] {
  return [...calendarOAuthDiagnostics];
}

export function clearCalendarOAuthDiagnostics(): void {
  calendarOAuthDiagnostics.length = 0;
}

function readPersistedConnectionMeta(): Omit<GoogleCalendarConnectionState, 'hasInMemoryToken'> {
  const platform = getCurrentPlatformTag();
  const fallback: Omit<GoogleCalendarConnectionState, 'hasInMemoryToken'> = {
    status: 'disconnected',
    scopeVerified: false,
    readVerified: false,
    writeVerified: false,
    platform
  };
  if (typeof window === 'undefined' || !window.localStorage) {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(CALENDAR_CONNECTION_META_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    // CRITICAL: Persisted metadata is NEVER proof of an active OAuth access token.
    // After app restart / process death, a previously connected state MUST downgrade
    // to 'needs_verification' until a live in-memory token is freshly obtained & verified.
    let hydratedStatus: GoogleCalendarConnectionStatus = parsed.status || 'disconnected';
    if (hydratedStatus === 'connected' || hydratedStatus === 'pending_redirect') {
      hydratedStatus = 'needs_verification';
    }

    return {
      status: hydratedStatus,
      accountEmail: typeof parsed.accountEmail === 'string' ? parsed.accountEmail : undefined,
      firebaseOwnerEmail: typeof parsed.firebaseOwnerEmail === 'string' ? parsed.firebaseOwnerEmail : undefined,
      calendarId: typeof parsed.calendarId === 'string' ? parsed.calendarId : undefined,
      calendarSummary: typeof parsed.calendarSummary === 'string' ? parsed.calendarSummary : undefined,
      calendarTimeZone: typeof parsed.calendarTimeZone === 'string' ? parsed.calendarTimeZone : undefined,
      calendarAccessRole: typeof parsed.calendarAccessRole === 'string' ? parsed.calendarAccessRole : undefined,
      scopeVerified: hydratedStatus === 'needs_verification' ? Boolean(parsed.scopeVerified) : false,
      readVerified: false,
      writeVerified: false,
      platform,
      lastVerifiedAtIso: typeof parsed.lastVerifiedAtIso === 'string' ? parsed.lastVerifiedAtIso : undefined,
      lastMessage:
        hydratedStatus === 'needs_verification'
          ? 'Verifying Google Calendar authorization...'
          : typeof parsed.lastMessage === 'string'
          ? parsed.lastMessage
          : undefined,
      lastErrorCode: typeof parsed.lastErrorCode === 'string' ? parsed.lastErrorCode : undefined
    };
  } catch {
    return fallback;
  }
}

let currentConnectionMeta: Omit<GoogleCalendarConnectionState, 'hasInMemoryToken'> = readPersistedConnectionMeta();
let testActiveFirebaseEmail: string | null | undefined = undefined;

function getActiveFirebaseUserEmail(): string | undefined {
  if (testActiveFirebaseEmail !== undefined) {
    return testActiveFirebaseEmail || undefined;
  }
  return auth.currentUser?.email || undefined;
}

function persistAndEmitConnectionMeta(
  next: Omit<GoogleCalendarConnectionState, 'hasInMemoryToken'>
): GoogleCalendarConnectionState {
  // Strictly strip any token-like fields before storing non-secret UI status metadata
  const safeMeta: Omit<GoogleCalendarConnectionState, 'hasInMemoryToken'> = {
    status: next.status,
    accountEmail: next.accountEmail,
    firebaseOwnerEmail: next.firebaseOwnerEmail,
    calendarId: next.calendarId,
    calendarSummary: next.calendarSummary,
    calendarTimeZone: next.calendarTimeZone,
    calendarAccessRole: next.calendarAccessRole,
    scopeVerified: Boolean(next.scopeVerified),
    readVerified: Boolean(next.readVerified),
    writeVerified: Boolean(next.writeVerified),
    platform: getCurrentPlatformTag(),
    lastVerifiedAtIso: next.lastVerifiedAtIso,
    lastMessage: sanitizeDiagnosticText(next.lastMessage),
    lastErrorCode: sanitizeDiagnosticText(next.lastErrorCode)
  };
  currentConnectionMeta = safeMeta;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CALENDAR_CONNECTION_META_STORAGE_KEY, JSON.stringify(safeMeta));
    } catch {
      // Ignore storage quota errors
    }
  }
  const snapshot = getGoogleCalendarConnectionState();
  connectionStateListeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // Ignore subscriber errors
    }
  });
  return snapshot;
}

export function getGoogleCalendarConnectionState(): GoogleCalendarConnectionState {
  const hasInMemoryToken = Boolean(getInMemoryGoogleCalendarToken());
  // Never report 'connected' if the in-memory token has expired or is absent
  const effectiveStatus: GoogleCalendarConnectionStatus =
    currentConnectionMeta.status === 'connected' && !hasInMemoryToken
      ? 'needs_verification'
      : currentConnectionMeta.status;
  return {
    ...currentConnectionMeta,
    status: effectiveStatus,
    platform: getCurrentPlatformTag(),
    hasInMemoryToken
  };
}

export function subscribeGoogleCalendarConnectionState(listener: ConnectionStateListener): () => void {
  connectionStateListeners.add(listener);
  try {
    listener(getGoogleCalendarConnectionState());
  } catch {
    // Ignore initial emit error
  }
  return () => {
    connectionStateListeners.delete(listener);
  };
}

export function __setCalendarFetchForTesting(fn: CalendarFetchFn | null): void {
  customCalendarFetchForTesting = fn;
}

export function __setWebCalendarAuthTestAdapter(adapter: WebCalendarAuthTestAdapter | null): void {
  webCalendarAuthTestAdapter = adapter;
  webRedirectProcessingPromise = null;
}

export function __resetCalendarOAuthStateForTesting(): void {
  clearInMemoryGoogleCalendarToken();
  lastInvalidatedAccessToken = null;
  inFlightCalendarAuthPromise = null;
  webRedirectProcessingPromise = null;
  testActiveFirebaseEmail = undefined;
  handledCalendarDeepLinkKeys.clear();
  clearCalendarOAuthDiagnostics();
  currentConnectionMeta = {
    status: 'disconnected',
    scopeVerified: false,
    readVerified: false,
    writeVerified: false,
    platform: getCurrentPlatformTag()
  };
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(CALENDAR_CONNECTION_META_STORAGE_KEY);
    } catch {}
  }
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(PENDING_WEB_CALENDAR_REDIRECT_KEY);
    } catch {}
  }
}

export function __simulateColdRestartForTesting(): GoogleCalendarConnectionState {
  inMemoryGoogleCalendarAccessToken = null;
  inMemoryTokenExpiresAtMs = 0;
  inMemoryTokenAccountEmail = null;
  lastInvalidatedAccessToken = null;
  inFlightCalendarAuthPromise = null;
  webRedirectProcessingPromise = null;
  currentConnectionMeta = readPersistedConnectionMeta();
  return getGoogleCalendarConnectionState();
}

export function __setInMemoryTokenExpiryForTesting(expiresAtMs: number): void {
  inMemoryTokenExpiresAtMs = expiresAtMs;
}

export function __simulateFirebaseAccountChangeForTesting(email: string | null): void {
  testActiveFirebaseEmail = email;
  handleFirebaseAccountIdentityChange(email);
}

export function clearInMemoryGoogleCalendarToken(markExpired = false, staleToken?: string): void {
  const invalidated = staleToken || inMemoryGoogleCalendarAccessToken;
  if (invalidated) {
    lastInvalidatedAccessToken = invalidated;
  }
  inMemoryGoogleCalendarAccessToken = null;
  inMemoryTokenExpiresAtMs = 0;
  inMemoryTokenAccountEmail = null;
  if (markExpired) {
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: 'expired',
      scopeVerified: false,
      readVerified: false,
      writeVerified: false,
      platform: getCurrentPlatformTag(),
      lastErrorCode: 'HTTP_401',
      lastMessage: 'Google Calendar authorization expired or is invalid. Please reconnect.'
    });
  }
}

export function getInMemoryGoogleCalendarToken(): string | null {
  if (!inMemoryGoogleCalendarAccessToken) return null;
  if (inMemoryTokenExpiresAtMs > 0 && Date.now() >= inMemoryTokenExpiresAtMs) {
    lastInvalidatedAccessToken = inMemoryGoogleCalendarAccessToken;
    inMemoryGoogleCalendarAccessToken = null;
    inMemoryTokenExpiresAtMs = 0;
    inMemoryTokenAccountEmail = null;
    return null;
  }
  return inMemoryGoogleCalendarAccessToken;
}

export async function disconnectGoogleCalendar(): Promise<void> {
  const tokenToClear = inMemoryGoogleCalendarAccessToken || lastInvalidatedAccessToken;
  const emailToRevoke = inMemoryTokenAccountEmail || currentConnectionMeta.accountEmail;
  clearInMemoryGoogleCalendarToken();
  lastInvalidatedAccessToken = null;
  if (isAndroidNativePlatform()) {
    if (tokenToClear) {
      await invokeNativeClearCalendarToken(tokenToClear);
    }
    if (emailToRevoke) {
      await invokeNativeRevokeCalendarAccess(emailToRevoke, GOOGLE_CALENDAR_SCOPE);
    }
  }
  persistAndEmitConnectionMeta({
    status: 'disconnected',
    scopeVerified: false,
    readVerified: false,
    writeVerified: false,
    platform: getCurrentPlatformTag(),
    lastMessage: 'Google Calendar disconnected.'
  });
  recordCalendarOAuthStage('calendar_oauth_disconnected', { ok: true });
}

function handleFirebaseAccountIdentityChange(userEmail: string | null | undefined): void {
  if (!userEmail) {
    const hadToken = Boolean(inMemoryGoogleCalendarAccessToken);
    const wasActive =
      currentConnectionMeta.status === 'connected' ||
      currentConnectionMeta.status === 'needs_verification' ||
      Boolean(currentConnectionMeta.accountEmail);
    clearInMemoryGoogleCalendarToken();
    lastInvalidatedAccessToken = null;
    if (hadToken || wasActive) {
      persistAndEmitConnectionMeta({
        status: 'disconnected',
        scopeVerified: false,
        readVerified: false,
        writeVerified: false,
        platform: getCurrentPlatformTag(),
        lastMessage: 'Signed out of Google account.'
      });
      recordCalendarOAuthStage('calendar_oauth_auth_state_cleared', {
        ok: true,
        detail: 'User signed out; cleared in-memory Calendar token and state'
      });
    }
    return;
  }

  const normalizedIncoming = userEmail.trim().toLowerCase();
  const normalizedFirebaseOwner = currentConnectionMeta.firebaseOwnerEmail?.trim().toLowerCase();
  const normalizedTokenEmail = inMemoryTokenAccountEmail?.trim().toLowerCase();
  const normalizedMetaEmail = currentConnectionMeta.accountEmail?.trim().toLowerCase();

  // If the Calendar connection explicitly recorded the Firebase owner that authorized it,
  // only invalidate when Firebase actually switches away from that owner — never loop-wipe
  // when a teacher intentionally connects a separate teaching Google account for Calendar.
  const hasSwitchedFirebaseAccount = normalizedFirebaseOwner
    ? normalizedFirebaseOwner !== normalizedIncoming
    : Boolean(
        (normalizedTokenEmail && normalizedTokenEmail !== normalizedIncoming) ||
          (normalizedMetaEmail && normalizedMetaEmail !== normalizedIncoming)
      );

  if (hasSwitchedFirebaseAccount) {
    clearInMemoryGoogleCalendarToken();
    lastInvalidatedAccessToken = null;
    persistAndEmitConnectionMeta({
      status: 'reconnect_required',
      accountEmail: undefined,
      firebaseOwnerEmail: undefined,
      calendarId: undefined,
      calendarSummary: undefined,
      calendarTimeZone: undefined,
      calendarAccessRole: undefined,
      scopeVerified: false,
      readVerified: false,
      writeVerified: false,
      platform: getCurrentPlatformTag(),
      lastErrorCode: 'ACCOUNT_SWITCHED',
      lastMessage: 'Active Google account changed. Please reconnect Google Calendar.'
    });
    recordCalendarOAuthStage('calendar_oauth_auth_state_cleared', {
      ok: true,
      code: 'ACCOUNT_SWITCHED',
      detail: 'Active Google account changed; cleared previous Calendar token & metadata'
    });
  }
}

// Clear in-memory Calendar OAuth token and stale account metadata whenever Firebase user signs out or switches accounts
if (typeof window !== 'undefined') {
  try {
    onAuthStateChanged(auth, (user) => {
      handleFirebaseAccountIdentityChange(user?.email || null);
    });
  } catch {
    // Ignore in headless/non-browser environments
  }
}

/**
 * Performs a lightweight read-only verification against Google Calendar API v3 `events.list`
 * (`GET /calendars/primary/events?maxResults=1&fields=summary,timeZone,accessRole`), which is
 * officially authorized by the `calendar.events` scope (unlike `calendars.get`, which returns 403
 * under `calendar.events`-only tokens). Also verifies `accessRole` is `owner` or `writer`.
 * Note: Read verification does NOT mark `writeVerified=true`; actual write permission is only
 * confirmed when an `events.insert` or `events.patch` succeeds (or caught if 403 occurs).
 */
function classifyGoogleCalendar403Error(payload: any): {
  code: string;
  permissionDenied: boolean;
  retryAfterClearToken: boolean;
  reason?: string;
  error: string;
} {
  const errObj = payload?.error || {};
  const firstErrorReason =
    typeof errObj?.errors?.[0]?.reason === 'string' ? errObj.errors[0].reason.trim() : '';
  const detailReason = Array.isArray(errObj?.details)
    ? errObj.details.find((d: any) => typeof d?.reason === 'string' && d.reason.trim())?.reason?.trim() || ''
    : '';
  const statusStr = typeof errObj?.status === 'string' ? errObj.status.trim() : '';
  const rawMessage = sanitizeDiagnosticText(typeof errObj?.message === 'string' ? errObj.message : '') || '';
  const reason = firstErrorReason || detailReason || statusStr || '';
  const combinedLower = `${reason} ${rawMessage}`.toLowerCase();

  // 1. Google Calendar API not enabled in Google Cloud project
  if (
    reason === 'accessNotConfigured' ||
    reason === 'SERVICE_DISABLED' ||
    combinedLower.includes('has not been used in project') ||
    combinedLower.includes('calendar-json.googleapis.com') ||
    (combinedLower.includes('google calendar api') && combinedLower.includes('disabled'))
  ) {
    return {
      code: 'CALENDAR_API_DISABLED',
      permissionDenied: false,
      retryAfterClearToken: false,
      reason: reason || 'accessNotConfigured',
      error:
        'Google Calendar API is disabled in the Google Cloud project (glueck-c8621). Enable "Google Calendar API" in Google Cloud Console → APIs & Services → Library, wait 1–2 minutes, then tap Reconnect.'
    };
  }

  // 2. Account has never activated Google Calendar
  if (reason === 'notACalendarUser' || combinedLower.includes('must be signed up for google calendar')) {
    return {
      code: 'NOT_A_CALENDAR_USER',
      permissionDenied: false,
      retryAfterClearToken: false,
      reason: reason || 'notACalendarUser',
      error:
        'This Google account does not have Google Calendar activated. Open calendar.google.com once with this account or switch to another Google account.'
    };
  }

  // 3. Quota / rate limit (Google APIs also return 403 for quota limits)
  if (
    reason === 'rateLimitExceeded' ||
    reason === 'userRateLimitExceeded' ||
    reason === 'dailyLimitExceeded' ||
    reason === 'quotaExceeded'
  ) {
    return {
      code: 'CALENDAR_QUOTA_EXCEEDED',
      permissionDenied: false,
      retryAfterClearToken: false,
      reason,
      error: 'Google Calendar API rate limit reached. Please wait a minute and try again.'
    };
  }

  // 4. Insufficient OAuth scopes or revoked Calendar permission
  const isExplicitScopeError =
    reason === 'insufficientPermissions' ||
    reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' ||
    reason === 'insufficient_scope' ||
    combinedLower.includes('insufficient authentication scopes') ||
    combinedLower.includes('insufficient permission');

  if (isExplicitScopeError || !reason) {
    return {
      code: 'INSUFFICIENT_SCOPE',
      permissionDenied: true,
      retryAfterClearToken: true,
      reason: reason || 'insufficientPermissions',
      error:
        'Google Calendar event permission (calendar.events) was not granted or was revoked. Tap Reconnect and make sure the Google Calendar permission checkbox is checked before tapping Continue.'
    };
  }

  // 5. Any other Google 403 reason — surface sanitized reason instead of hiding it
  return {
    code: 'HTTP_403',
    permissionDenied: true,
    retryAfterClearToken: true,
    reason,
    error: `Google Calendar access was denied (403: ${sanitizeDiagnosticText(reason)}). ${rawMessage ? `${rawMessage} ` : ''}Please reconnect and approve Calendar access.`
  };
}

export async function verifyGoogleCalendarAuthorization(
  accessToken: string,
  fallbackEmail?: string
): Promise<{
  ok: boolean;
  accountEmail?: string;
  calendarId?: string;
  calendarSummary?: string;
  calendarTimeZone?: string;
  calendarAccessRole?: string;
  expired?: boolean;
  permissionDenied?: boolean;
  retryAfterClearToken?: boolean;
  errorCode?: string;
  status?: number;
  error?: string;
}> {
  const fetchFn = customCalendarFetchForTesting || fetch;
  recordCalendarOAuthStage('calendar_oauth_verify_calendar_start');
  try {
    const res = await fetchFn(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=1&fields=summary,timeZone,accessRole',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    if (res.status === 401) {
      lastInvalidatedAccessToken = accessToken;
      clearInMemoryGoogleCalendarToken();
      recordCalendarOAuthStage('calendar_oauth_verify_calendar_failed', {
        ok: false,
        code: 'HTTP_401',
        detail: 'Access token expired or invalid'
      });
      return {
        ok: false,
        expired: true,
        errorCode: 'HTTP_401',
        status: 401,
        error: 'Google Calendar authorization expired or is invalid. Please reconnect.'
      };
    }

    if (res.status === 403) {
      const errorPayload = await res.json().catch(() => null);
      const classified = classifyGoogleCalendar403Error(errorPayload);
      if (classified.retryAfterClearToken) {
        lastInvalidatedAccessToken = accessToken;
      }
      clearInMemoryGoogleCalendarToken();
      recordCalendarOAuthStage('calendar_oauth_verify_calendar_failed', {
        ok: false,
        code: classified.code,
        detail: classified.reason
          ? `Calendar 403 (${sanitizeDiagnosticText(classified.reason)})`
          : 'Calendar permission denied or missing calendar.events scope'
      });
      return {
        ok: false,
        permissionDenied: classified.permissionDenied,
        retryAfterClearToken: classified.retryAfterClearToken,
        errorCode: classified.code,
        status: 403,
        error: classified.error
      };
    }

    if (!res.ok) {
      recordCalendarOAuthStage('calendar_oauth_verify_calendar_failed', {
        ok: false,
        code: `HTTP_${res.status}`,
        detail: 'Primary calendar events.list verification failed'
      });
      return {
        ok: false,
        errorCode: `HTTP_${res.status}`,
        status: res.status,
        error: `Could not verify Google Calendar access (HTTP ${res.status}).`
      };
    }

    const data = await res.json().catch(() => ({}));
    const calendarSummary =
      typeof data?.summary === 'string' && data.summary.trim() ? data.summary.trim() : undefined;
    const calendarTimeZone =
      typeof data?.timeZone === 'string' && data.timeZone.trim() ? data.timeZone.trim() : undefined;
    const calendarAccessRole =
      typeof data?.accessRole === 'string' && data.accessRole.trim() ? data.accessRole.trim() : undefined;

    if (
      calendarAccessRole &&
      calendarAccessRole !== 'owner' &&
      calendarAccessRole !== 'writer'
    ) {
      clearInMemoryGoogleCalendarToken();
      recordCalendarOAuthStage('calendar_oauth_verify_calendar_failed', {
        ok: false,
        code: 'WRITE_ACCESS_DENIED',
        detail: `Calendar accessRole=${calendarAccessRole} does not permit event writes`
      });
      return {
        ok: false,
        permissionDenied: true,
        status: 403,
        error: `This Google Calendar only allows read-only access (${calendarAccessRole}). Event write access is required.`
      };
    }

    const calendarId =
      calendarSummary && calendarSummary.includes('@') ? calendarSummary : 'primary';
    const accountEmail =
      (calendarSummary && calendarSummary.includes('@') ? calendarSummary : undefined) ||
      fallbackEmail ||
      getActiveFirebaseUserEmail() ||
      undefined;

    recordCalendarOAuthStage('calendar_oauth_verify_calendar_ok', {
      ok: true,
      detail: `Verified events.list read access (role=${calendarAccessRole || 'unknown'}, tz=${calendarTimeZone || 'unknown'})`
    });

    return {
      ok: true,
      accountEmail,
      calendarId,
      calendarSummary,
      calendarTimeZone,
      calendarAccessRole
    };
  } catch (err: any) {
    recordCalendarOAuthStage('calendar_oauth_verify_calendar_failed', {
      ok: false,
      code: 'NETWORK_ERROR',
      detail: err?.message || 'Network failure verifying Calendar access'
    });
    return {
      ok: false,
      error: 'Network error while verifying Google Calendar connection. Please try again.'
    };
  }
}

async function finalizeVerifiedCalendarToken(params: {
  accessToken: string;
  fallbackEmail?: string;
  platform: 'android_native' | 'web';
  scopeExplicitlyVerified: boolean;
}): Promise<GoogleCalendarTokenResult> {
  const verify = await verifyGoogleCalendarAuthorization(params.accessToken, params.fallbackEmail);
  if (!verify.ok) {
    const resolvedErrorCode = verify.errorCode || (verify.status ? `HTTP_${verify.status}` : 'VERIFY_FAILED');
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: verify.expired ? 'expired' : verify.permissionDenied ? 'reconnect_required' : 'error',
      scopeVerified: false,
      readVerified: false,
      writeVerified: false,
      platform: params.platform,
      lastMessage: verify.error,
      lastErrorCode: resolvedErrorCode
    });
    return {
      ok: false,
      expired: verify.expired,
      retryAfterClearToken: verify.retryAfterClearToken,
      platform: params.platform,
      error: verify.error,
      code: resolvedErrorCode
    };
  }

  inMemoryGoogleCalendarAccessToken = params.accessToken;
  // Conservative 45-minute client-side TTL (strictly under Google's 60-minute OAuth access token expiry)
  inMemoryTokenExpiresAtMs = Date.now() + 45 * 60 * 1000;
  inMemoryTokenAccountEmail = verify.accountEmail || params.fallbackEmail || null;
  lastInvalidatedAccessToken = null;

  persistAndEmitConnectionMeta({
    status: 'connected',
    accountEmail: verify.accountEmail,
    firebaseOwnerEmail: getActiveFirebaseUserEmail(),
    calendarId: verify.calendarId,
    calendarSummary: verify.calendarSummary,
    calendarTimeZone: verify.calendarTimeZone,
    calendarAccessRole: verify.calendarAccessRole,
    scopeVerified: params.scopeExplicitlyVerified,
    readVerified: true,
    writeVerified: false, // Confirmed ONLY after a real events.insert / events.patch succeeds
    platform: params.platform,
    lastVerifiedAtIso: new Date().toISOString(),
    lastMessage: verify.accountEmail
      ? `Connected to Google Calendar (${verify.accountEmail}).`
      : 'Connected to Google Calendar.'
  });

  return {
    ok: true,
    accessToken: params.accessToken,
    accountEmail: verify.accountEmail,
    calendarSummary: verify.calendarSummary,
    scopeVerified: params.scopeExplicitlyVerified,
    readVerified: true,
    writeVerified: false,
    platform: params.platform
  };
}

function isWebPopupCancellation(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  return code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request';
}

function shouldFallbackToWebRedirect(err: any): boolean {
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'auth/popup-blocked' ||
    code === 'auth/operation-not-supported-in-this-environment'
  );
}

function markPendingWebCalendarRedirect(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(
      PENDING_WEB_CALENDAR_REDIRECT_KEY,
      JSON.stringify({
        startedAtIso: new Date().toISOString(),
        returnTo: 'settings_integrations'
      })
    );
  } catch {
    // Ignore sessionStorage restrictions
  }
}

function consumePendingWebCalendarRedirectFlag(): boolean {
  if (typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    const raw = window.sessionStorage.getItem(PENDING_WEB_CALENDAR_REDIRECT_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(PENDING_WEB_CALENDAR_REDIRECT_KEY);
    return true;
  } catch {
    return false;
  }
}

async function executeAndroidNativeCalendarOAuth(
  forcePrompt: boolean,
  options: { silentOnly?: boolean; allowStale401Retry?: boolean } = {}
): Promise<GoogleCalendarTokenResult> {
  // STRICT SEPARATION: On Capacitor Android, NEVER invoke Firebase Web popup or redirect flows
  // (which launch /__/auth/handler in an external browser without window.opener and hang on a white screen).
  const silentOnly = Boolean(options.silentOnly);
  const allowStale401Retry = options.allowStale401Retry !== false;

  // Enforce account consistency before requesting a Play Services token
  const activeFirebaseEmail = getActiveFirebaseUserEmail();
  if (activeFirebaseEmail) {
    handleFirebaseAccountIdentityChange(activeFirebaseEmail);
  }

  recordCalendarOAuthStage('calendar_oauth_android_native_invoke', {
    detail: `forcePrompt=${forcePrompt} silentOnly=${silentOnly}`
  });

  try {
    const staleToken =
      forcePrompt || lastInvalidatedAccessToken
        ? lastInvalidatedAccessToken || inMemoryGoogleCalendarAccessToken || undefined
        : undefined;
    const prevErrorCode = currentConnectionMeta.lastErrorCode;
    const shouldRevokeBeforeInteractiveReconnect =
      forcePrompt &&
      !silentOnly &&
      (prevErrorCode === 'INSUFFICIENT_SCOPE' ||
        prevErrorCode === 'HTTP_403' ||
        prevErrorCode === 'SCOPE_NOT_GRANTED');
    if (forcePrompt) {
      clearInMemoryGoogleCalendarToken();
    }

    if (shouldRevokeBeforeInteractiveReconnect) {
      const revokeEmail = activeFirebaseEmail || currentConnectionMeta.accountEmail || undefined;
      if (revokeEmail) {
        await invokeNativeRevokeCalendarAccess(revokeEmail, GOOGLE_CALENDAR_SCOPE).catch(() => ({
          revoked: false
        }));
      }
    }

    // Prefer the connected Calendar account email when silently refreshing; fall back to active Firebase email
    const accountHint = forcePrompt
      ? undefined
      : currentConnectionMeta.accountEmail || activeFirebaseEmail || undefined;

    const nativeRes = await invokeNativeGoogleCalendarAuthorize({
      accountEmail: accountHint,
      scope: GOOGLE_CALENDAR_SCOPE,
      forceAccountSelection: forcePrompt,
      silentOnly,
      staleAccessToken: staleToken
    });

    if (nativeRes?.resolutionRequired) {
      const msg =
        'Google Calendar authorization requires reconnection. Tap Reconnect Google Calendar to approve access.';
      recordCalendarOAuthStage('calendar_oauth_android_native_resolution_required', {
        ok: false,
        code: 'RESOLUTION_REQUIRED',
        detail: nativeRes.reason || msg
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'reconnect_required',
        scopeVerified: false,
        readVerified: false,
        writeVerified: false,
        platform: 'android_native',
        lastMessage: msg,
        lastErrorCode: 'RESOLUTION_REQUIRED'
      });
      return {
        ok: false,
        resolutionRequired: true,
        platform: 'android_native',
        code: 'RESOLUTION_REQUIRED',
        error: msg
      };
    }

    if (nativeRes?.cancelled) {
      recordCalendarOAuthStage('calendar_oauth_android_native_cancelled', {
        ok: false,
        code: 'USER_CANCELLED',
        detail: nativeRes.reason || 'Native consent cancelled'
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'cancelled',
        readVerified: false,
        writeVerified: false,
        platform: 'android_native',
        lastMessage: 'Google Calendar authorization was cancelled.',
        lastErrorCode: 'USER_CANCELLED'
      });
      return {
        ok: false,
        cancelled: true,
        platform: 'android_native',
        code: 'USER_CANCELLED',
        error: 'Google Calendar authorization was cancelled.'
      };
    }

    const accessToken = nativeRes?.accessToken;
    if (!accessToken) {
      recordCalendarOAuthStage('calendar_oauth_error', {
        ok: false,
        code: 'EMPTY_ACCESS_TOKEN',
        detail: 'Native authorization completed without access token'
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'reconnect_required',
        scopeVerified: false,
        readVerified: false,
        writeVerified: false,
        platform: 'android_native',
        lastMessage: 'Google authorization completed, but no Calendar access token was returned.',
        lastErrorCode: 'EMPTY_ACCESS_TOKEN'
      });
      return {
        ok: false,
        platform: 'android_native',
        code: 'EMPTY_ACCESS_TOKEN',
        error: 'Google authorization completed, but no Calendar access token was returned.'
      };
    }

    if (nativeRes.scopeVerified !== true) {
      recordCalendarOAuthStage('calendar_oauth_error', {
        ok: false,
        code: 'SCOPE_NOT_GRANTED',
        detail: 'Google Calendar events write scope (calendar.events) was not granted'
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'reconnect_required',
        scopeVerified: false,
        readVerified: false,
        writeVerified: false,
        platform: 'android_native',
        lastMessage: 'Google Calendar event write permission (calendar.events) was not granted.',
        lastErrorCode: 'SCOPE_NOT_GRANTED'
      });
      return {
        ok: false,
        platform: 'android_native',
        code: 'SCOPE_NOT_GRANTED',
        error: 'Google Calendar event write permission (calendar.events) was not granted. Please allow Calendar access and retry.'
      };
    }

    recordCalendarOAuthStage('calendar_oauth_android_native_token_received', {
      ok: true,
      detail: nativeRes.stage || 'native_authorized'
    });

    const finalized = await finalizeVerifiedCalendarToken({
      accessToken,
      fallbackEmail: nativeRes.email || activeFirebaseEmail || currentConnectionMeta.accountEmail,
      platform: 'android_native',
      scopeExplicitlyVerified: true
    });

    // If Play Services returned a stale/revoked cached token (401 or 403 insufficient scope),
    // strictly await AuthorizationClient.clearToken() before attempting ONE fresh retry.
    if (!finalized.ok && (finalized.expired || finalized.retryAfterClearToken) && allowStale401Retry) {
      const clearRes = await invokeNativeClearCalendarToken(accessToken);
      if (finalized.retryAfterClearToken && !silentOnly) {
        const revokeEmail = nativeRes.email || activeFirebaseEmail || currentConnectionMeta.accountEmail || undefined;
        if (revokeEmail) {
          await invokeNativeRevokeCalendarAccess(revokeEmail, GOOGLE_CALENDAR_SCOPE).catch(() => ({
            revoked: false
          }));
        }
      }
      recordCalendarOAuthStage('calendar_oauth_android_stale_token_cleared', {
        ok: Boolean(clearRes?.cleared),
        detail: finalized.expired
          ? 'Awaited Play Services token clear after 401; retrying once'
          : 'Awaited Play Services token clear after 403 scope error; retrying once'
      });
      lastInvalidatedAccessToken = clearRes?.cleared ? null : accessToken;
      return executeAndroidNativeCalendarOAuth(forcePrompt, {
        silentOnly,
        allowStale401Retry: false
      });
    }

    return finalized;
  } catch (err: any) {
    const code = String(err?.code || 'ANDROID_CALENDAR_AUTH_ERROR');
    const message =
      sanitizeDiagnosticText(err?.message) ||
      'Native Android Google Calendar authorization failed. Please try again.';
    recordCalendarOAuthStage('calendar_oauth_error', {
      ok: false,
      code,
      detail: message
    });
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: silentOnly ? 'reconnect_required' : 'error',
      scopeVerified: false,
      readVerified: false,
      writeVerified: false,
      platform: 'android_native',
      lastMessage: message,
      lastErrorCode: code
    });
    return {
      ok: false,
      platform: 'android_native',
      code,
      error: message
    };
  }
}

async function executeWebCalendarOAuth(forcePrompt: boolean): Promise<GoogleCalendarTokenResult> {
  recordCalendarOAuthStage('calendar_oauth_web_popup_start', {
    detail: `forcePrompt=${forcePrompt}`
  });

  if (forcePrompt) {
    clearInMemoryGoogleCalendarToken();
  }

  try {
    let accessToken: string | undefined;
    let fallbackEmail: string | undefined = auth.currentUser?.email || undefined;

    if (webCalendarAuthTestAdapter?.popupAuthorize) {
      const adapterRes = await webCalendarAuthTestAdapter.popupAuthorize({
        forcePrompt,
        scope: GOOGLE_CALENDAR_SCOPE
      });
      accessToken = adapterRes?.accessToken;
      fallbackEmail = adapterRes?.email || fallbackEmail;
    } else {
      const provider = new GoogleAuthProvider();
      provider.addScope(GOOGLE_CALENDAR_SCOPE);
      provider.setCustomParameters({
        prompt: forcePrompt ? 'consent select_account' : 'consent'
      });

      let result: UserCredential;
      if (auth.currentUser) {
        const hasGoogleLinked = (auth.currentUser.providerData || []).some(
          (p) => p?.providerId === 'google.com'
        );
        if (hasGoogleLinked) {
          result = await reauthenticateWithPopup(auth.currentUser, provider);
        } else {
          try {
            result = await linkWithPopup(auth.currentUser, provider);
          } catch (linkErr: any) {
            if (
              linkErr?.code === 'auth/credential-already-in-use' ||
              linkErr?.code === 'auth/provider-already-linked'
            ) {
              result = await signInWithPopup(auth, provider);
            } else {
              throw linkErr;
            }
          }
        }
      } else {
        result = await signInWithPopup(auth, provider);
      }

      const credential = GoogleAuthProvider.credentialFromResult(result);
      accessToken = credential?.accessToken;
      fallbackEmail = result?.user?.email || fallbackEmail;
    }

    if (!accessToken) {
      const msg = 'Google authorization completed, but no Calendar access token was granted.';
      recordCalendarOAuthStage('calendar_oauth_error', {
        ok: false,
        code: 'EMPTY_ACCESS_TOKEN',
        detail: msg
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'error',
        scopeVerified: false,
        platform: 'web',
        lastMessage: msg,
        lastErrorCode: 'EMPTY_ACCESS_TOKEN'
      });
      return {
        ok: false,
        platform: 'web',
        code: 'EMPTY_ACCESS_TOKEN',
        error: msg
      };
    }

    return finalizeVerifiedCalendarToken({
      accessToken,
      fallbackEmail,
      platform: 'web',
      scopeExplicitlyVerified: false
    });
  } catch (err: any) {
    if (isWebPopupCancellation(err)) {
      const msg = 'Google Calendar authorization was cancelled.';
      recordCalendarOAuthStage('calendar_oauth_error', {
        ok: false,
        code: String(err?.code || 'USER_CANCELLED'),
        detail: msg
      });
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'cancelled',
        readVerified: false,
        writeVerified: false,
        platform: 'web',
        lastMessage: msg,
        lastErrorCode: 'USER_CANCELLED'
      });
      return {
        ok: false,
        cancelled: true,
        platform: 'web',
        code: 'USER_CANCELLED',
        error: msg
      };
    }

    if (shouldFallbackToWebRedirect(err)) {
      recordCalendarOAuthStage('calendar_oauth_web_popup_fallback_redirect', {
        ok: true,
        code: String(err?.code || 'POPUP_BLOCKED'),
        detail: 'Falling back to Web Firebase redirect flow'
      });
      markPendingWebCalendarRedirect();
      persistAndEmitConnectionMeta({
        ...currentConnectionMeta,
        status: 'pending_redirect',
        readVerified: false,
        writeVerified: false,
        platform: 'web',
        lastMessage: 'Redirecting to Google to finish Calendar authorization...'
      });

      if (webCalendarAuthTestAdapter?.redirectAuthorize) {
        await webCalendarAuthTestAdapter.redirectAuthorize({
          forcePrompt,
          scope: GOOGLE_CALENDAR_SCOPE
        });
      } else {
        const provider = new GoogleAuthProvider();
        provider.addScope(GOOGLE_CALENDAR_SCOPE);
        provider.setCustomParameters({
          prompt: forcePrompt ? 'consent select_account' : 'consent'
        });
        if (auth.currentUser) {
          const hasGoogleLinked = (auth.currentUser.providerData || []).some(
            (p) => p?.providerId === 'google.com'
          );
          if (hasGoogleLinked) {
            await reauthenticateWithRedirect(auth.currentUser, provider);
          } else {
            await linkWithRedirect(auth.currentUser, provider);
          }
        } else {
          await signInWithRedirect(auth, provider);
        }
      }

      return {
        ok: false,
        redirected: true,
        platform: 'web',
        code: 'WEB_REDIRECT_STARTED',
        error: 'Redirecting to Google to complete Calendar authorization...'
      };
    }

    const code = String(err?.code || 'WEB_CALENDAR_AUTH_ERROR');
    const msg =
      sanitizeDiagnosticText(err?.message) ||
      'Google Calendar authorization failed. Please try again.';
    recordCalendarOAuthStage('calendar_oauth_error', {
      ok: false,
      code,
      detail: msg
    });
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: 'error',
      scopeVerified: false,
      readVerified: false,
      writeVerified: false,
      platform: 'web',
      lastMessage: msg,
      lastErrorCode: code
    });
    return {
      ok: false,
      platform: 'web',
      code,
      error: msg
    };
  }
}

/**
 * Non-interactive startup/mount verification of Google Calendar authorization:
 * - Never treats persisted metadata as proof of a valid token.
 * - On Android Capacitor: uses `AuthorizationClient.authorize(silentOnly=true)`.
 *   If Play Services still holds a valid grant (`hasResolution=false`), obtains a fresh
 *   in-memory token and verifies Calendar access. If consent/re-login is required
 *   (`hasResolution=true` — e.g. revoked permissions), transitions cleanly to `'reconnect_required'`
 *   without showing an unsolicited popup and without falsely reporting connected.
 * - On Web: if no in-memory token exists after restart, marks `'reconnect_required'`.
 */
export async function verifyOrSilentlyReauthorizeGoogleCalendar(
  options: { forceSilentCheck?: boolean } = {}
): Promise<GoogleCalendarTokenResult> {
  const activeEmail = getActiveFirebaseUserEmail();
  if (activeEmail) {
    handleFirebaseAccountIdentityChange(activeEmail);
  }

  const existing = getInMemoryGoogleCalendarToken();
  if (existing) {
    return {
      ok: true,
      accessToken: existing,
      accountEmail: inMemoryTokenAccountEmail || currentConnectionMeta.accountEmail,
      calendarSummary: currentConnectionMeta.calendarSummary,
      scopeVerified: currentConnectionMeta.scopeVerified,
      readVerified: currentConnectionMeta.readVerified,
      writeVerified: currentConnectionMeta.writeVerified,
      platform: getCurrentPlatformTag()
    };
  }

  const shouldAttempt =
    options.forceSilentCheck || currentConnectionMeta.status === 'needs_verification';
  if (!shouldAttempt) {
    return {
      ok: false,
      platform: getCurrentPlatformTag(),
      code: 'NOT_CONNECTED',
      error: currentConnectionMeta.lastMessage || 'Google Calendar is not connected.'
    };
  }

  if (isAndroidNativePlatform()) {
    if (inFlightCalendarAuthPromise) {
      return inFlightCalendarAuthPromise;
    }
    inFlightCalendarAuthPromise = executeAndroidNativeCalendarOAuth(false, { silentOnly: true });
    try {
      return await inFlightCalendarAuthPromise;
    } finally {
      inFlightCalendarAuthPromise = null;
    }
  }

  const msg = 'Google Calendar session ended after reload. Tap Connect Google Calendar to re-authorize.';
  persistAndEmitConnectionMeta({
    ...currentConnectionMeta,
    status: 'reconnect_required',
    scopeVerified: false,
    readVerified: false,
    writeVerified: false,
    platform: 'web',
    lastErrorCode: 'SESSION_ENDED',
    lastMessage: msg
  });
  return {
    ok: false,
    resolutionRequired: true,
    platform: 'web',
    code: 'SESSION_ENDED',
    error: msg
  };
}

/**
 * Acquires a client-side Google Calendar OAuth access token strictly in-memory:
 * - On Capacitor Android: uses native Google Identity Services AuthorizationClient
 *   (zero external browser /__/auth/handler white screen).
 * - On Web: uses Firebase Auth GoogleAuthProvider popup with clean redirect fallback
 *   and single-shot startup `getRedirectResult` processing.
 */
export async function requestGoogleCalendarAccessToken(
  forcePrompt = false
): Promise<GoogleCalendarTokenResult> {
  const activeEmail = getActiveFirebaseUserEmail();
  if (activeEmail) {
    handleFirebaseAccountIdentityChange(activeEmail);
  }

  if (!forcePrompt) {
    const existing = getInMemoryGoogleCalendarToken();
    if (existing) {
      recordCalendarOAuthStage('calendar_oauth_memory_cache_hit', { ok: true });
      return {
        ok: true,
        accessToken: existing,
        accountEmail: inMemoryTokenAccountEmail || currentConnectionMeta.accountEmail,
        calendarSummary: currentConnectionMeta.calendarSummary,
        scopeVerified: currentConnectionMeta.scopeVerified,
        readVerified: currentConnectionMeta.readVerified,
        writeVerified: currentConnectionMeta.writeVerified,
        platform: getCurrentPlatformTag()
      };
    }
  }

  if (inFlightCalendarAuthPromise) {
    return inFlightCalendarAuthPromise;
  }

  recordCalendarOAuthStage('calendar_oauth_start', {
    detail: `forcePrompt=${forcePrompt}`
  });

  inFlightCalendarAuthPromise = (async () => {
    if (isAndroidNativePlatform()) {
      return executeAndroidNativeCalendarOAuth(forcePrompt, { silentOnly: false });
    }
    return executeWebCalendarOAuth(forcePrompt);
  })();

  try {
    return await inFlightCalendarAuthPromise;
  } finally {
    inFlightCalendarAuthPromise = null;
  }
}

/**
 * Processes a pending Web Firebase Auth redirect result exactly once on app startup.
 * Strictly a no-op on Capacitor Android native platforms.
 */
export async function processPendingWebCalendarRedirectResult(): Promise<WebCalendarRedirectStartupResult> {
  if (isAndroidNativePlatform()) {
    return { handled: false, ok: false, shouldOpenIntegrations: false };
  }
  if (webRedirectProcessingPromise) {
    return webRedirectProcessingPromise;
  }

  webRedirectProcessingPromise = (async (): Promise<WebCalendarRedirectStartupResult> => {
    const hadPendingCalendarRedirect = consumePendingWebCalendarRedirectFlag();
    recordCalendarOAuthStage('calendar_oauth_web_redirect_result_check', {
      detail: `hadPendingCalendarRedirect=${hadPendingCalendarRedirect}`
    });

    try {
      let accessToken: string | undefined;
      let email: string | undefined;

      if (webCalendarAuthTestAdapter?.consumeRedirectResult) {
        const res = await webCalendarAuthTestAdapter.consumeRedirectResult();
        accessToken = res?.accessToken;
        email = res?.email;
      } else {
        const res = await consumeFirebaseWebRedirectResultOnce();
        if (res) {
          const cred = GoogleAuthProvider.credentialFromResult(res);
          accessToken = cred?.accessToken;
          email = res.user?.email || undefined;
        }
      }

      if (accessToken) {
        const finalized = await finalizeVerifiedCalendarToken({
          accessToken,
          fallbackEmail: email,
          platform: 'web',
          scopeExplicitlyVerified: false
        });
        recordCalendarOAuthStage('calendar_oauth_web_redirect_result_processed', {
          ok: finalized.ok,
          detail: finalized.ok ? 'Redirect token verified' : finalized.error
        });
        return {
          handled: true,
          ok: finalized.ok,
          shouldOpenIntegrations: true,
          accountEmail: finalized.accountEmail,
          message: finalized.ok
            ? finalized.accountEmail
              ? `Google Calendar connected (${finalized.accountEmail}).`
              : 'Google Calendar connected.'
            : finalized.error
        };
      }

      if (hadPendingCalendarRedirect) {
        const msg = 'Google Calendar authorization did not complete. Please try again.';
        persistAndEmitConnectionMeta({
          ...currentConnectionMeta,
          status: 'cancelled',
          platform: 'web',
          lastMessage: msg,
          lastErrorCode: 'REDIRECT_INCOMPLETE'
        });
        recordCalendarOAuthStage('calendar_oauth_web_redirect_result_processed', {
          ok: false,
          code: 'REDIRECT_INCOMPLETE',
          detail: msg
        });
        return {
          handled: true,
          ok: false,
          shouldOpenIntegrations: true,
          message: msg
        };
      }

      return { handled: false, ok: false, shouldOpenIntegrations: false };
    } catch (err: any) {
      const cancelled = isWebPopupCancellation(err);
      const code = String(err?.code || 'WEB_REDIRECT_ERROR');
      const msg = cancelled
        ? 'Google Calendar authorization was cancelled.'
        : sanitizeDiagnosticText(err?.message) || 'Google Calendar redirect authorization failed.';
      if (hadPendingCalendarRedirect) {
        persistAndEmitConnectionMeta({
          ...currentConnectionMeta,
          status: cancelled ? 'cancelled' : 'error',
          platform: 'web',
          lastMessage: msg,
          lastErrorCode: code
        });
      }
      recordCalendarOAuthStage('calendar_oauth_error', {
        ok: false,
        code,
        detail: msg
      });
      return {
        handled: hadPendingCalendarRedirect,
        ok: false,
        shouldOpenIntegrations: hadPendingCalendarRedirect,
        message: hadPendingCalendarRedirect ? msg : undefined
      };
    }
  })();

  return webRedirectProcessingPromise;
}

/**
 * Handles Android/Capacitor deep-link callbacks targeting Calendar OAuth or Integrations
 * (e.g., `glueck://oauth/calendar/callback`, `glueck://integrations`) exactly once so
 * the app always lands on Settings -> Integrations with a clear status message.
 */
export function handleCalendarOAuthDeepLinkCallback(rawUrl: string): CalendarDeepLinkCallbackResult {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { matched: false, alreadyHandled: false, shouldOpenIntegrations: false, status: 'open_integrations' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { matched: false, alreadyHandled: false, shouldOpenIntegrations: false, status: 'open_integrations' };
  }

  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase();
  if (scheme !== 'glueck' && scheme !== 'ags19') {
    return { matched: false, alreadyHandled: false, shouldOpenIntegrations: false, status: 'open_integrations' };
  }

  const normalizedRoute = `${parsed.host}${parsed.pathname}`.replace(/\/+$/, '').toLowerCase();
  const isCalendarCallback =
    normalizedRoute === 'oauth/calendar/callback' ||
    normalizedRoute === 'oauth/google/callback' ||
    normalizedRoute === 'calendar/callback';
  const isIntegrationsRoute =
    normalizedRoute === 'integrations' || normalizedRoute === 'settings/integrations';

  if (!isCalendarCallback && !isIntegrationsRoute) {
    return { matched: false, alreadyHandled: false, shouldOpenIntegrations: false, status: 'open_integrations' };
  }

  if (isIntegrationsRoute) {
    recordCalendarOAuthStage('calendar_oauth_deeplink_callback', {
      ok: true,
      detail: 'Opened Settings -> Integrations via deep link'
    });
    return {
      matched: true,
      alreadyHandled: false,
      shouldOpenIntegrations: true,
      status: 'open_integrations'
    };
  }

  // Deduplicate callback handling using safe non-secret key (never store tokens/codes)
  const rawStatus = (parsed.searchParams.get('status') || '').toLowerCase();
  const rawError = (parsed.searchParams.get('error') || '').toLowerCase();
  const safeNonce = parsed.searchParams.get('state') ? `state_len_${parsed.searchParams.get('state')!.length}` : 'no_state';
  const dedupeKey = `${scheme}://${normalizedRoute}?status=${rawStatus}&error=${rawError}&nonce=${safeNonce}`;

  if (handledCalendarDeepLinkKeys.has(dedupeKey)) {
    recordCalendarOAuthStage('calendar_oauth_deeplink_callback', {
      ok: true,
      detail: 'Duplicate Calendar OAuth deep-link callback ignored'
    });
    return {
      matched: true,
      alreadyHandled: true,
      shouldOpenIntegrations: true,
      status: currentConnectionMeta.status === 'connected' ? 'connected' : 'open_integrations'
    };
  }
  handledCalendarDeepLinkKeys.add(dedupeKey);

  if (rawError === 'access_denied' || rawStatus === 'cancelled' || rawStatus === 'canceled') {
    const msg = 'Google Calendar authorization was cancelled.';
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: 'cancelled',
      lastMessage: msg,
      lastErrorCode: 'USER_CANCELLED'
    });
    recordCalendarOAuthStage('calendar_oauth_deeplink_callback', {
      ok: false,
      code: 'USER_CANCELLED',
      detail: msg
    });
    return {
      matched: true,
      alreadyHandled: false,
      shouldOpenIntegrations: true,
      status: 'cancelled',
      message: msg
    };
  }

  if (rawError || rawStatus === 'error') {
    const msg = `Google Calendar authorization failed (${sanitizeDiagnosticText(rawError) || 'oauth_error'}). Please try again from Settings → Integrations.`;
    persistAndEmitConnectionMeta({
      ...currentConnectionMeta,
      status: 'error',
      lastMessage: msg,
      lastErrorCode: sanitizeDiagnosticText(rawError) || 'OAUTH_CALLBACK_ERROR'
    });
    recordCalendarOAuthStage('calendar_oauth_deeplink_callback', {
      ok: false,
      code: sanitizeDiagnosticText(rawError) || 'OAUTH_CALLBACK_ERROR',
      detail: 'Calendar OAuth callback returned error'
    });
    return {
      matched: true,
      alreadyHandled: false,
      shouldOpenIntegrations: true,
      status: 'error',
      message: msg
    };
  }

  const msg = getInMemoryGoogleCalendarToken()
    ? 'Google Calendar is connected and ready to sync.'
    : 'Returned to Glück Settings → Integrations. Tap Sync Google Calendar to complete verification.';
  recordCalendarOAuthStage('calendar_oauth_deeplink_callback', {
    ok: true,
    detail: 'Handled Calendar OAuth deep-link callback cleanly'
  });
  return {
    matched: true,
    alreadyHandled: false,
    shouldOpenIntegrations: true,
    status: getInMemoryGoogleCalendarToken() ? 'connected' : 'open_integrations',
    message: msg
  };
}

function escapeIcsText(value: string): string {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function foldIcsLine(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  let idx = 0;
  while (idx < line.length) {
    const chunkSize = idx === 0 ? 74 : 73;
    parts.push((idx === 0 ? '' : ' ') + line.slice(idx, idx + chunkSize));
    idx += chunkSize;
  }
  return parts.join('\r\n');
}

function formatIcsLocalDateTime(dateYmd: string, startTimeHm: string, addMinutes = 0): string {
  const [y, m, d] = dateYmd.split('-').map(Number);
  const [hh, mm] = startTimeHm.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + addMinutes, 0));
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  const ho = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}${mo}${da}T${ho}${mi}00`;
}

function formatIcsUtcStamp(date: Date = new Date()): string {
  const iso = date.toISOString();
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

/**
 * Generates an RFC 5545 compliant `.ics` calendar file for one or more weekly sessions.
 * Uses immutable `session.calendarEventUid` (`gluck-session-{id}@glueck.app`) so re-importing
 * updates existing calendar events rather than creating duplicates.
 */
export function generateSessionsIcsContent(
  sessions: GroupWeeklySession[],
  options: { calendarName?: string; referenceDate?: Date } = {}
): string {
  const activeSessions = (sessions || []).filter((s) => s && !s.deleted);
  const calName = escapeIcsText(options.calendarName || 'Glück Weekly Zoom Sessions');
  const refDate = options.referenceDate || new Date();
  const dtStamp = formatIcsUtcStamp(refDate);

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Glueck//Zoom Session Manager v2//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldIcsLine(`X-WR-CALNAME:${calName}`)
  ];

  for (const s of activeSessions) {
    const uid = s.calendarEventUid || generateStableCalendarUid(s.id);
    const tz = s.timezone || DEFAULT_ZOOM_TIMEZONE;
    const { dateYmd } = computeNextSessionStartWallTime(s.weekday, s.startTime, tz, refDate, s.recurrence);
    const duration = Math.max(15, Number(s.durationMinutes) || 60);
    const dtStart = formatIcsLocalDateTime(dateYmd, s.startTime, 0);
    const dtEnd = formatIcsLocalDateTime(dateYmd, s.startTime, duration);
    const byDay = toRRuleByDay(s.weekday);
    const interval = s.recurrence === 'biweekly_a' || s.recurrence === 'biweekly_b' ? 2 : 1;
    const joinUrl = s.zoomJoinUrl || s.manualFallbackUrl || '';

    const descriptionLines = [
      `Group: ${s.groupNameSnapshot}`,
      `Session ID: ${s.sessionCode}`,
      `Standardized Title: ${s.standardizedTitle}`,
      joinUrl ? `Zoom Link: ${joinUrl}` : 'Zoom Link: Pending sync',
      s.zoomMeetingId ? `Zoom Meeting ID: ${s.zoomMeetingId}` : '',
      s.zoomPasscode ? `Passcode: ${s.zoomPasscode}` : '',
      `Timezone: ${tz}`
    ].filter(Boolean);

    lines.push('BEGIN:VEVENT');
    lines.push(foldIcsLine(`UID:${uid}`));
    lines.push(`DTSTAMP:${dtStamp}`);
    lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(s.standardizedTitle)}`));
    lines.push(foldIcsLine(`DTSTART;TZID=${tz}:${dtStart}`));
    lines.push(foldIcsLine(`DTEND;TZID=${tz}:${dtEnd}`));
    lines.push(`RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`);
    if (joinUrl) {
      lines.push(foldIcsLine(`LOCATION:${escapeIcsText(joinUrl)}`));
      lines.push(foldIcsLine(`URL:${joinUrl}`));
    }
    lines.push(foldIcsLine(`DESCRIPTION:${escapeIcsText(descriptionLines.join('\n'))}`));
    lines.push(`SEQUENCE:${Math.max(0, Number(s.version || 1) - 1)}`);
    lines.push('STATUS:CONFIRMED');
    lines.push('BEGIN:VALARM');
    lines.push('ACTION:DISPLAY');
    lines.push(foldIcsLine(`DESCRIPTION:Upcoming class: ${escapeIcsText(s.standardizedTitle)}`));
    lines.push('TRIGGER:-PT15M');
    lines.push('END:VALARM');
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

export function downloadSessionsIcsFile(
  sessions: GroupWeeklySession[],
  filename = 'glueck_zoom_schedule.ics'
): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const icsContent = generateSessionsIcsContent(sessions);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Builds an explicit preview of Google Calendar mutations BEFORE calling write endpoints.
 */
export function buildGoogleCalendarSyncPreview(
  sessions: GroupWeeklySession[],
  options: {
    forceUpdateSynced?: boolean;
    includeDeletedCleanup?: boolean;
  } = {}
): {
  items: CalendarSyncPreviewItem[];
  createCount: number;
  updateCount: number;
  deleteCount: number;
  skipSyncedCount: number;
} {
  const forceUpdateSynced = Boolean(options.forceUpdateSynced);
  const includeDeletedCleanup = Boolean(options.includeDeletedCleanup);

  const active = (sessions || []).filter((s) => s && !s.deleted);
  const activeItems: CalendarSyncPreviewItem[] = active.map((s) => {
    const uid = s.calendarEventUid || generateStableCalendarUid(s.id);
    const deterministicGoogleEventId = deriveDeterministicGoogleEventId(s.id);
    let action: CalendarSyncPreviewItem['action'] = 'create';
    if (s.googleCalendarEventId) {
      action = s.calendarSyncStatus === 'synced' && !forceUpdateSynced ? 'skip_synced' : 'update';
    }
    return {
      sessionId: s.id,
      sessionCode: s.sessionCode,
      standardizedTitle: s.standardizedTitle,
      calendarEventUid: uid,
      deterministicGoogleEventId,
      googleCalendarEventId: s.googleCalendarEventId,
      googleCalendarIcalUid: s.googleCalendarIcalUid,
      weekdayName: s.weekdayName,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      timezone: s.timezone || DEFAULT_ZOOM_TIMEZONE,
      recurrence: s.recurrence,
      zoomJoinUrl: s.zoomJoinUrl || s.manualFallbackUrl,
      action
    };
  });

  const deleteItems: CalendarSyncPreviewItem[] = includeDeletedCleanup
    ? (sessions || [])
        .filter((s) => s && s.deleted && Boolean(s.googleCalendarEventId))
        .map((s) => ({
          sessionId: s.id,
          sessionCode: s.sessionCode,
          standardizedTitle: s.standardizedTitle,
          calendarEventUid: s.calendarEventUid || generateStableCalendarUid(s.id),
          deterministicGoogleEventId: deriveDeterministicGoogleEventId(s.id),
          googleCalendarEventId: s.googleCalendarEventId,
          googleCalendarIcalUid: s.googleCalendarIcalUid,
          weekdayName: s.weekdayName,
          startTime: s.startTime,
          durationMinutes: s.durationMinutes,
          timezone: s.timezone || DEFAULT_ZOOM_TIMEZONE,
          recurrence: s.recurrence,
          zoomJoinUrl: s.zoomJoinUrl || s.manualFallbackUrl,
          action: 'delete' as const
        }))
    : [];

  const items = [...activeItems, ...deleteItems];

  return {
    items,
    createCount: items.filter((i) => i.action === 'create').length,
    updateCount: items.filter((i) => i.action === 'update').length,
    deleteCount: items.filter((i) => i.action === 'delete').length,
    skipSyncedCount: items.filter((i) => i.action === 'skip_synced').length
  };
}

function addMinutesToIsoWallClock(startIsoLocal: string, minutes: number): string {
  const [datePart, timePart] = startIsoLocal.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes, 0));
  const yy = dt.getUTCFullYear();
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const da = String(dt.getUTCDate()).padStart(2, '0');
  const ho = String(dt.getUTCHours()).padStart(2, '0');
  const mi = String(dt.getUTCMinutes()).padStart(2, '0');
  return `${yy}-${mo}-${da}T${ho}:${mi}:00`;
}

function isTransient403RateLimit(classified: ReturnType<typeof classifyGoogleCalendar403Error>): boolean {
  return (
    classified.code === 'CALENDAR_QUOTA_EXCEEDED' &&
    (classified.reason === 'rateLimitExceeded' || classified.reason === 'userRateLimitExceeded')
  );
}

async function fetchCalendarWithRetry(params: {
  fetchFn: CalendarFetchFn;
  url: string;
  init: RequestInit;
  maxRetries?: number;
  baseDelayMs?: number;
}): Promise<{ res: Response; classified403?: ReturnType<typeof classifyGoogleCalendar403Error> }> {
  const maxRetries = Math.max(0, Math.min(4, params.maxRetries ?? 3));
  const baseDelayMs =
    typeof params.baseDelayMs === 'number'
      ? Math.max(0, params.baseDelayMs)
      : customCalendarFetchForTesting
      ? 0
      : 450;

  const method = String(params.init?.method || 'GET').toUpperCase();
  const isIdempotentMethod = method === 'GET' || method === 'HEAD' || method === 'PATCH' || method === 'DELETE';

  let attempt = 0;
  while (true) {
    let res: Response;
    try {
      res = await params.fetchFn(params.url, params.init);
    } catch (err) {
      if (isIdempotentMethod && attempt < maxRetries) {
        attempt++;
        if (baseDelayMs > 0) await sleepCalendarMs(baseDelayMs * attempt);
        continue;
      }
      throw err;
    }

    if (res.status === 403) {
      const payload = await res
        .clone()
        .json()
        .catch(() => null);
      const classified403 = classifyGoogleCalendar403Error(payload);
      if (isTransient403RateLimit(classified403) && attempt < maxRetries) {
        attempt++;
        const retryAfterHeader = res.headers?.get?.('Retry-After');
        const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
        const waitMs = Math.max(retryAfterMs, baseDelayMs * attempt);
        if (waitMs > 0) await sleepCalendarMs(waitMs);
        continue;
      }
      return { res, classified403 };
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      attempt++;
      const retryAfterHeader = res.headers?.get?.('Retry-After');
      const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
      const waitMs = Math.max(retryAfterMs, baseDelayMs * attempt);
      if (waitMs > 0) await sleepCalendarMs(waitMs);
      continue;
    }

    return { res };
  }
}

async function resolveExistingGoogleEventId(params: {
  fetchFn: CalendarFetchFn;
  calendarId: string;
  accessToken: string;
  deterministicEventId: string;
  sessionId: string;
  retryDelayMs?: number;
}): Promise<{
  eventId?: string;
  iCalUID?: string;
  authExpired?: boolean;
  classified403?: ReturnType<typeof classifyGoogleCalendar403Error>;
}> {
  const headers = {
    Authorization: `Bearer ${params.accessToken}`,
    Accept: 'application/json'
  };

  // 1. Direct lookup using deterministic Google Calendar event.id (zero scanning of unrelated events)
  const directUrl = `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events/${encodeURIComponent(params.deterministicEventId)}`;
  const { res: directRes, classified403: direct403 } = await fetchCalendarWithRetry({
    fetchFn: params.fetchFn,
    url: directUrl,
    init: { method: 'GET', headers },
    baseDelayMs: params.retryDelayMs
  });
  if (directRes.status === 401) {
    return { authExpired: true };
  }
  if (directRes.status === 403 && direct403) {
    return { classified403: direct403 };
  }
  if (directRes.ok) {
    const evt = await directRes.json();
    const ownerSessionId = evt?.extendedProperties?.private?.gluckSessionId;
    if (evt?.id && (!ownerSessionId || ownerSessionId === params.sessionId)) {
      return {
        eventId: String(evt.id),
        iCalUID: typeof evt.iCalUID === 'string' ? evt.iCalUID : undefined
      };
    }
  }

  // 2. Fallback lookup via supported privateExtendedProperty query parameter
  const propFilter = encodeURIComponent(`gluckSessionId=${params.sessionId}`);
  const propUrl = `https://www.googleapis.com/calendar/v3/calendars/${params.calendarId}/events?privateExtendedProperty=${propFilter}&showDeleted=true&maxResults=10`;
  const { res: propRes, classified403: prop403 } = await fetchCalendarWithRetry({
    fetchFn: params.fetchFn,
    url: propUrl,
    init: { method: 'GET', headers },
    baseDelayMs: params.retryDelayMs
  });
  if (propRes.status === 401) {
    return { authExpired: true };
  }
  if (propRes.status === 403 && prop403) {
    return { classified403: prop403 };
  }
  if (propRes.ok) {
    const json = await propRes.json();
    const items = Array.isArray(json?.items) ? json.items : [];
    const exactMatch = items.find(
      (item: any) =>
        item &&
        item.id &&
        item.extendedProperties?.private?.gluckSessionId === params.sessionId
    );
    if (exactMatch) {
      return {
        eventId: String(exactMatch.id),
        iCalUID: typeof exactMatch.iCalUID === 'string' ? exactMatch.iCalUID : undefined
      };
    }
  }

  return {};
}

/**
 * Syncs weekly sessions to Google Calendar v3 using a deterministic, valid `event.id` (`^[a-v0-9]{5,1024}$`)
 * and `privateExtendedProperty=gluckSessionId=...` lookups—never assigning custom `iCalUID` on `events.insert`
 * and never patching/deleting unrelated user Calendar events.
 * Stores returned Google `event.id` and Google `iCalUID` separately from Glück's immutable `calendarEventUid`.
 */
export async function syncSessionsToGoogleCalendar(params: {
  allSessions: GroupWeeklySession[];
  targetSessionIds?: Set<string>;
  accessToken: string;
  calendarId?: string;
  forceUpdateSynced?: boolean;
  removeDeletedSessions?: boolean;
  referenceDate?: Date;
  retryDelayMs?: number;
  onProgress?: (completed: number, total: number, title: string) => void;
}): Promise<CalendarSyncResult> {
  const fetchFn = customCalendarFetchForTesting || fetch;
  const calendarId = encodeURIComponent(params.calendarId || 'primary');
  const workingSessions = [...(params.allSessions || [])];

  const targets = workingSessions.filter((s) => {
    if (!s || s.deleted) return false;
    if (params.targetSessionIds && !params.targetSessionIds.has(s.id)) return false;
    if (!params.forceUpdateSynced && s.googleCalendarEventId && s.calendarSyncStatus === 'synced') {
      return false;
    }
    return true;
  });

  // Clean up remote Google Calendar events for soft-deleted/archived Glück sessions that still carry an event ID
  const shouldRemoveDeleted =
    typeof params.removeDeletedSessions === 'boolean'
      ? params.removeDeletedSessions
      : !params.targetSessionIds;

  const deletedTargets = shouldRemoveDeleted
    ? workingSessions.filter((s) => {
        if (!s || !s.deleted || !s.googleCalendarEventId) return false;
        if (params.targetSessionIds && !params.targetSessionIds.has(s.id)) return false;
        return true;
      })
    : [];

  const totalWorkItems = targets.length + deletedTargets.length;
  let completedWorkItems = 0;

  let createdCount = 0;
  let updatedCount = 0;
  let deletedCount = 0;
  const skippedCount = workingSessions.filter((s) => !s.deleted).length - targets.length;
  let failedCount = 0;
  let authExpired = false;
  let scopeInsufficient = false;
  let rateLimited = false;
  let fatalErrorCode: string | undefined;
  const errors: Array<{ sessionId: string; title: string; error: string; status?: number; code?: string }> = [];

  const throwClassified403 = (classified: ReturnType<typeof classifyGoogleCalendar403Error>) => {
    throw Object.assign(new Error(classified.error), {
      status: 403,
      classified403: classified
    });
  };

  for (let i = 0; i < targets.length; i++) {
    const session = targets[i];
    params.onProgress?.(completedWorkItems, totalWorkItems, session.standardizedTitle);

    // Gentle pacing between rapid multi-session writes to stay comfortably below Google per-second burst quotas
    if (i > 0 && !customCalendarFetchForTesting) {
      await sleepCalendarMs(120);
    }

    const uid = session.calendarEventUid || generateStableCalendarUid(session.id);
    const deterministicEventId = deriveDeterministicGoogleEventId(session.id);
    const tz = session.timezone || DEFAULT_ZOOM_TIMEZONE;
    const { startTimeIsoLocal } = computeNextSessionStartWallTime(
      session.weekday,
      session.startTime,
      tz,
      params.referenceDate,
      session.recurrence
    );
    const endTimeIsoLocal = addMinutesToIsoWallClock(startTimeIsoLocal, Math.max(15, Number(session.durationMinutes) || 60));
    const byDay = toRRuleByDay(session.weekday);
    const interval = session.recurrence === 'biweekly_a' || session.recurrence === 'biweekly_b' ? 2 : 1;
    const joinUrl = session.zoomJoinUrl || session.manualFallbackUrl || '';

    const description = [
      `Glück Weekly Online Session`,
      `Session ID: ${session.sessionCode}`,
      `Group: ${session.groupNameSnapshot}`,
      joinUrl ? `Zoom Link: ${joinUrl}` : 'Zoom Link: Not yet generated',
      session.zoomMeetingId ? `Zoom Meeting ID: ${session.zoomMeetingId}` : '',
      session.zoomPasscode ? `Passcode: ${session.zoomPasscode}` : '',
      `Schedule UID: ${uid}`
    ]
      .filter(Boolean)
      .join('\n');

    // Mutable event resource fields (NEVER include iCalUID on insert or patch)
    const mutableEventBody = {
      summary: session.standardizedTitle,
      location: joinUrl || '',
      description,
      start: {
        dateTime: startTimeIsoLocal,
        timeZone: tz
      },
      end: {
        dateTime: endTimeIsoLocal,
        timeZone: tz
      },
      recurrence: [`RRULE:FREQ=WEEKLY;INTERVAL=${interval};BYDAY=${byDay}`],
      extendedProperties: {
        private: {
          gluckSessionId: session.id,
          gluckSessionCode: session.sessionCode,
          gluckGroupId: session.groupId,
          gluckCalendarUid: uid,
          ...(session.zoomMeetingId ? { zoomMeetingId: session.zoomMeetingId } : {})
        }
      }
    };

    const persistSyncedSession = (savedEvent: any, fallbackEventId: string, nowMs: number) => {
      const idx = workingSessions.findIndex((s) => s.id === session.id);
      if (idx >= 0) {
        const returnedId = String(savedEvent?.id || fallbackEventId);
        const returnedIcalUid =
          typeof savedEvent?.iCalUID === 'string' && savedEvent.iCalUID.trim()
            ? savedEvent.iCalUID.trim()
            : workingSessions[idx].googleCalendarIcalUid;
        const isoNow = new Date(nowMs).toISOString();
        workingSessions[idx] = {
          ...workingSessions[idx],
          calendarEventUid: uid, // Remains strictly immutable for ICS & Grain matching
          googleCalendarEventId: returnedId,
          googleCalendarIcalUid: returnedIcalUid,
          calendarSyncStatus: 'synced',
          calendarSyncError: undefined,
          googleCalendarSyncedAt: isoNow,
          lastCalendarSyncedAt: isoNow,
          updatedAt: nowMs
        };
      }
    };

    const runPatch = async (targetEventId: string) => {
      const patchUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(targetEventId)}`;
      return fetchCalendarWithRetry({
        fetchFn,
        url: patchUrl,
        init: {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            ...mutableEventBody,
            status: 'confirmed'
          })
        },
        baseDelayMs: params.retryDelayMs
      });
    };

    try {
      let existingEventId = session.googleCalendarEventId;

      if (!existingEventId) {
        const lookup = await resolveExistingGoogleEventId({
          fetchFn,
          calendarId,
          accessToken: params.accessToken,
          deterministicEventId,
          sessionId: session.id,
          retryDelayMs: params.retryDelayMs
        });
        if (lookup.authExpired) {
          clearInMemoryGoogleCalendarToken(true, params.accessToken);
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (lookup.classified403) {
          throwClassified403(lookup.classified403);
        }
        existingEventId = lookup.eventId;
      }

      const nowMs = Date.now();
      if (existingEventId) {
        const { res: patchRes, classified403: patch403 } = await runPatch(existingEventId);
        if (patchRes.status === 401) {
          clearInMemoryGoogleCalendarToken(true, params.accessToken);
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (patchRes.status === 403) {
          throwClassified403(
            patch403 || {
              code: 'HTTP_403_WRITE_DENIED',
              permissionDenied: true,
              retryAfterClearToken: true,
              error: 'Google Calendar event write permission (calendar.events) was denied (403). Please reconnect and allow event editing.'
            }
          );
        }
        if (patchRes.ok) {
          const updatedEvent = await patchRes.json();
          persistSyncedSession(updatedEvent, existingEventId, nowMs);
          if (!currentConnectionMeta.writeVerified && getInMemoryGoogleCalendarToken()) {
            persistAndEmitConnectionMeta({
              ...currentConnectionMeta,
              status: 'connected',
              scopeVerified: true,
              readVerified: true,
              writeVerified: true,
              lastVerifiedAtIso: new Date().toISOString()
            });
            recordCalendarOAuthStage('calendar_oauth_write_verified', {
              ok: true,
              detail: 'Confirmed event write permission via events.patch'
            });
          }
          updatedCount++;
          completedWorkItems++;
          continue;
        }
        // If stored ID returned 404/410, probe via safe deterministic/extended-property lookup before inserting
        if (patchRes.status === 404 || patchRes.status === 410) {
          const fallbackLookup = await resolveExistingGoogleEventId({
            fetchFn,
            calendarId,
            accessToken: params.accessToken,
            deterministicEventId,
            sessionId: session.id,
            retryDelayMs: params.retryDelayMs
          });
          if (fallbackLookup.authExpired) {
            clearInMemoryGoogleCalendarToken(true, params.accessToken);
            authExpired = true;
            throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
              status: 401
            });
          }
          if (fallbackLookup.classified403) {
            throwClassified403(fallbackLookup.classified403);
          }
          if (fallbackLookup.eventId && fallbackLookup.eventId !== existingEventId) {
            const { res: retryPatch, classified403: retry403 } = await runPatch(fallbackLookup.eventId);
            if (retryPatch.status === 403 && retry403) {
              throwClassified403(retry403);
            }
            if (retryPatch.ok) {
              const updatedEvent = await retryPatch.json();
              persistSyncedSession(updatedEvent, fallbackLookup.eventId, nowMs);
              updatedCount++;
              completedWorkItems++;
              continue;
            }
          }
        } else {
          const errText = await patchRes.text().catch(() => '');
          throw Object.assign(
            new Error(errText || `Google Calendar PATCH returned HTTP ${patchRes.status}`),
            { status: patchRes.status }
          );
        }
      }

      // Create using deterministic valid Google Calendar event.id (`^[a-v0-9]{5,1024}$`), NEVER custom iCalUID
      const createUrl = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
      const { res: createRes, classified403: create403 } = await fetchCalendarWithRetry({
        fetchFn,
        url: createUrl,
        init: {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json'
          },
          body: JSON.stringify({
            id: deterministicEventId,
            ...mutableEventBody
          })
        },
        baseDelayMs: params.retryDelayMs
      });

      if (createRes.status === 401) {
        clearInMemoryGoogleCalendarToken(true, params.accessToken);
        authExpired = true;
        throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
          status: 401
        });
      }

      if (createRes.status === 403) {
        throwClassified403(
          create403 || {
            code: 'HTTP_403_WRITE_DENIED',
            permissionDenied: true,
            retryAfterClearToken: true,
            error: 'Google Calendar event write permission (calendar.events) was denied (403). Please reconnect and allow event editing.'
          }
        );
      }

      // 409 Conflict: idempotent recovery when event with deterministic id already exists remotely (e.g. interrupted prior POST or deleted event)
      if (createRes.status === 409) {
        const conflictLookup = await resolveExistingGoogleEventId({
          fetchFn,
          calendarId,
          accessToken: params.accessToken,
          deterministicEventId,
          sessionId: session.id,
          retryDelayMs: params.retryDelayMs
        });
        if (conflictLookup.authExpired) {
          clearInMemoryGoogleCalendarToken(true, params.accessToken);
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (conflictLookup.classified403) {
          throwClassified403(conflictLookup.classified403);
        }
        const recoverTargetId = conflictLookup.eventId || deterministicEventId;
        const { res: recoverPatch, classified403: recover403 } = await runPatch(recoverTargetId);
        if (recoverPatch.status === 401) {
          clearInMemoryGoogleCalendarToken(true, params.accessToken);
          authExpired = true;
          throw Object.assign(new Error('Google Calendar OAuth token expired or unauthorized (401). Please reconnect.'), {
            status: 401
          });
        }
        if (recoverPatch.status === 403) {
          throwClassified403(
            recover403 || {
              code: 'HTTP_403_WRITE_DENIED',
              permissionDenied: true,
              retryAfterClearToken: true,
              error: 'Google Calendar event write permission (calendar.events) was denied (403). Please reconnect and allow event editing.'
            }
          );
        }
        if (!recoverPatch.ok) {
          const errText = await recoverPatch.text().catch(() => '');
          throw Object.assign(
            new Error(errText || `Google Calendar 409 recovery PATCH returned HTTP ${recoverPatch.status}`),
            { status: recoverPatch.status }
          );
        }
        const recoveredEvent = await recoverPatch.json();
        persistSyncedSession(recoveredEvent, recoverTargetId, nowMs);
        if (!currentConnectionMeta.writeVerified && getInMemoryGoogleCalendarToken()) {
          persistAndEmitConnectionMeta({
            ...currentConnectionMeta,
            status: 'connected',
            scopeVerified: true,
            readVerified: true,
            writeVerified: true,
            lastVerifiedAtIso: new Date().toISOString()
          });
        }
        updatedCount++;
        completedWorkItems++;
        continue;
      }

      if (!createRes.ok) {
        const errText = await createRes.text().catch(() => '');
        throw Object.assign(
          new Error(errText || `Google Calendar POST returned HTTP ${createRes.status}`),
          { status: createRes.status }
        );
      }

      const createdEvent = await createRes.json();
      persistSyncedSession(createdEvent, deterministicEventId, nowMs);
      if (!currentConnectionMeta.writeVerified && getInMemoryGoogleCalendarToken()) {
        persistAndEmitConnectionMeta({
          ...currentConnectionMeta,
          status: 'connected',
          scopeVerified: true,
          readVerified: true,
          writeVerified: true,
          lastVerifiedAtIso: new Date().toISOString()
        });
        recordCalendarOAuthStage('calendar_oauth_write_verified', {
          ok: true,
          detail: 'Confirmed event write permission via events.insert'
        });
      }
      createdCount++;
      completedWorkItems++;
    } catch (err: any) {
      failedCount++;
      completedWorkItems++;
      const classified403: ReturnType<typeof classifyGoogleCalendar403Error> | undefined = err?.classified403;
      const errMsg = sanitizeDiagnosticText(err?.message) || 'Calendar sync failed.';
      const errCode = classified403?.code || (err?.status ? `HTTP_${err.status}` : undefined);
      errors.push({
        sessionId: session.id,
        title: session.standardizedTitle,
        error: errMsg,
        ...(typeof err?.status === 'number' ? { status: err.status } : {}),
        ...(errCode ? { code: errCode } : {})
      });
      const failIdx = workingSessions.findIndex((s) => s.id === session.id);
      if (failIdx >= 0) {
        const nowFailMs = Date.now();
        workingSessions[failIdx] = {
          ...workingSessions[failIdx],
          calendarSyncStatus: 'error',
          calendarSyncError: errMsg,
          updatedAt: nowFailMs
        };
      }
      if (err?.status === 401) {
        lastInvalidatedAccessToken = params.accessToken;
        clearInMemoryGoogleCalendarToken();
        persistAndEmitConnectionMeta({
          ...currentConnectionMeta,
          status: 'expired',
          scopeVerified: false,
          readVerified: false,
          writeVerified: false,
          lastMessage: 'Google Calendar authorization expired (401). Please reconnect.',
          lastErrorCode: 'HTTP_401'
        });
        authExpired = true;
        fatalErrorCode = 'HTTP_401';
        break;
      }
      if (err?.status === 403) {
        if (!classified403 || classified403.permissionDenied) {
          lastInvalidatedAccessToken = params.accessToken;
          clearInMemoryGoogleCalendarToken();
          persistAndEmitConnectionMeta({
            ...currentConnectionMeta,
            status: 'reconnect_required',
            scopeVerified: false,
            readVerified: false,
            writeVerified: false,
            lastMessage:
              classified403?.error ||
              'Missing Google Calendar event write permission (calendar.events). Please reconnect and allow Calendar editing.',
            lastErrorCode: classified403?.code || 'HTTP_403_WRITE_DENIED'
          });
          recordCalendarOAuthStage('calendar_oauth_write_permission_denied', {
            ok: false,
            code: classified403?.code || 'HTTP_403_WRITE_DENIED',
            detail: classified403?.reason
              ? `Event write endpoint returned 403 (${classified403.reason})`
              : 'Event write endpoint returned 403 Forbidden'
          });
          scopeInsufficient = true;
          fatalErrorCode = classified403?.code || 'HTTP_403_WRITE_DENIED';
          break;
        }

        // Non-permission 403 (API disabled, not a Calendar user, or rate/quota limit):
        // Preserve valid in-memory token and surface the exact root cause without false Reconnect Required.
        if (classified403.code === 'CALENDAR_QUOTA_EXCEEDED') {
          rateLimited = true;
        }
        fatalErrorCode = classified403.code;
        persistAndEmitConnectionMeta({
          ...currentConnectionMeta,
          status: 'error',
          lastMessage: classified403.error,
          lastErrorCode: classified403.code
        });
        recordCalendarOAuthStage('calendar_oauth_error', {
          ok: false,
          code: classified403.code,
          detail: classified403.reason || classified403.code
        });
        break;
      }
      if (err?.status === 429) {
        rateLimited = true;
        fatalErrorCode = 'HTTP_429';
      }
    }
  }

  // Delete orphaned remote Google Calendar events for soft-deleted/archived Glück sessions
  if (!authExpired && !scopeInsufficient && !fatalErrorCode && deletedTargets.length > 0) {
    for (let j = 0; j < deletedTargets.length; j++) {
      const delSession = deletedTargets[j];
      const targetEventId = delSession.googleCalendarEventId;
      if (!targetEventId) continue;

      params.onProgress?.(completedWorkItems, totalWorkItems, `Removing deleted: ${delSession.standardizedTitle}`);
      if (j > 0 && !customCalendarFetchForTesting) {
        await sleepCalendarMs(120);
      }

      const delRes = await deleteGoogleCalendarEventForCleanup({
        eventId: targetEventId,
        accessToken: params.accessToken,
        calendarId: params.calendarId,
        retryDelayMs: params.retryDelayMs ?? (customCalendarFetchForTesting ? 0 : 450)
      });
      completedWorkItems++;

      if (delRes.ok && delRes.deleted) {
        const idx = workingSessions.findIndex((s) => s.id === delSession.id);
        if (idx >= 0) {
          workingSessions[idx] = {
            ...workingSessions[idx],
            googleCalendarEventId: undefined,
            googleCalendarIcalUid: undefined,
            calendarSyncStatus: 'not_synced',
            calendarSyncError: undefined,
            updatedAt: Date.now()
          };
        }
        deletedCount++;
      } else {
        failedCount++;
        const delErr = delRes.error || `Failed to remove deleted Calendar event (${delRes.status}).`;
        errors.push({
          sessionId: delSession.id,
          title: delSession.standardizedTitle,
          error: delErr,
          ...(typeof delRes.status === 'number' ? { status: delRes.status } : {})
        });
        if (delRes.authExpired) {
          authExpired = true;
          fatalErrorCode = 'HTTP_401';
          break;
        }
        if (delRes.permissionDenied) {
          scopeInsufficient = true;
          fatalErrorCode = 'HTTP_403_WRITE_DENIED';
          break;
        }
        if (delRes.rateLimited) {
          rateLimited = true;
          break;
        }
      }
    }
  }

  params.onProgress?.(totalWorkItems, totalWorkItems, '');

  return {
    success: failedCount === 0,
    ...(authExpired ? { authExpired: true } : {}),
    ...(scopeInsufficient ? { scopeInsufficient: true } : {}),
    ...(rateLimited ? { rateLimited: true } : {}),
    ...(fatalErrorCode ? { errorCode: fatalErrorCode } : {}),
    createdCount,
    updatedCount,
    deletedCount,
    skippedCount,
    failedCount,
    sessions: workingSessions,
    errors
  };
}

/**
 * Convenience wrapper for syncing or verifying ONE selected weekly session against Google Calendar.
 */
export async function syncSingleSessionToGoogleCalendar(params: {
  allSessions: GroupWeeklySession[];
  sessionId: string;
  accessToken: string;
  calendarId?: string;
  forceUpdateSynced?: boolean;
  referenceDate?: Date;
}): Promise<CalendarSyncResult> {
  return syncSessionsToGoogleCalendar({
    allSessions: params.allSessions,
    targetSessionIds: new Set([params.sessionId]),
    accessToken: params.accessToken,
    calendarId: params.calendarId,
    forceUpdateSynced: params.forceUpdateSynced,
    referenceDate: params.referenceDate
  });
}

// ============================================================================
// Google Calendar Cleanup Helpers (Strict Confident Matching Only)
// ============================================================================

export interface GoogleCalendarCleanupEvent {
  id: string;
  iCalUID?: string;
  summary: string;
  location?: string;
  description?: string;
  status?: string;
  startDateTime?: string;
  endDateTime?: string;
  recurrence?: string[];
  recurringEventId?: string;
  hangoutLink?: string;
  conferenceJoinUrls: string[];
  privateExtendedProperties: Record<string, string>;
  extractedZoomMeetingIds: string[];
  extractedZoomJoinUrls: string[];
}

export type CalendarCleanupMatchSignal =
  | 'stored_google_calendar_event_id'
  | 'deterministic_gluck_event_id'
  | 'private_extended_property_gluck_session_id'
  | 'deleted_zoom_meeting_id'
  | 'deleted_zoom_join_url'
  | 'stored_session_or_history_zoom_mapping';

export interface CalendarCleanupEventDecision {
  eventId: string;
  summary: string;
  startDateTime?: string;
  isRecurringSeries: boolean;
  matched: boolean;
  ambiguous: boolean;
  signals: CalendarCleanupMatchSignal[];
  matchedZoomMeetingIds: string[];
  matchedSessionId?: string;
  reason: string;
}

export interface CalendarCleanupMatchSummary {
  totalEventsScanned: number;
  matchedToDelete: CalendarCleanupEventDecision[];
  untouchedEventsCount: number;
  ambiguousEvents: CalendarCleanupEventDecision[];
}

export interface CalendarListCleanupEventsResult {
  ok: boolean;
  status: number;
  events: GoogleCalendarCleanupEvent[];
  pagesFetched: number;
  authExpired?: boolean;
  permissionDenied?: boolean;
  rateLimited?: boolean;
  error?: string;
}

export interface CalendarDeleteEventResult {
  ok: boolean;
  status: number;
  eventId: string;
  deleted: boolean;
  alreadyDeleted?: boolean;
  authExpired?: boolean;
  permissionDenied?: boolean;
  rateLimited?: boolean;
  error?: string;
}

function sleepCalendarMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeZoomUrlForMatching(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase();
    if (!host.endsWith('zoom.us')) return '';
    // Normalize path & lowercase host; strip ephemeral tracking/hash but preserve meeting path (/j/<id> or /wc/join/<id> or /s/<id>)
    const cleanPath = u.pathname.replace(/\/+$/, '');
    const pwd = u.searchParams.get('pwd');
    return `${u.protocol}//${host}${cleanPath}${pwd ? `?pwd=${pwd}` : ''}`;
  } catch {
    return '';
  }
}

function normalizeZoomUrlPathKey(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.trim());
    if (!u.hostname.toLowerCase().endsWith('zoom.us')) return '';
    return u.pathname.replace(/\/+$/, '').toLowerCase();
  } catch {
    return '';
  }
}

function extractZoomReferencesFromText(texts: string[]): {
  meetingIds: string[];
  normalizedUrls: string[];
} {
  const idSet = new Set<string>();
  const urlSet = new Set<string>();
  const urlRegex = /https?:\/\/[a-z0-9.-]*zoom\.us\/(?:j|wc\/join|s|w)\/[0-9]{8,15}(?:\?[^\s<>"')\]}]+)?/gi;
  const pathIdRegex = /zoom\.us\/(?:j|wc\/join|s|w)\/([0-9]{8,15})/gi;
  const explicitIdRegex = /(?:zoom\s+meeting\s+id|meeting\s+id)\s*[:#]\s*([0-9][0-9\s-]{7,18}[0-9])/gi;

  for (const text of texts) {
    if (!text) continue;
    let m: RegExpExecArray | null;
    urlRegex.lastIndex = 0;
    while ((m = urlRegex.exec(text)) !== null) {
      const cleaned = m[0].replace(/[.,;!?]+$/, '');
      const norm = normalizeZoomUrlForMatching(cleaned);
      if (norm) urlSet.add(norm);
    }
    pathIdRegex.lastIndex = 0;
    while ((m = pathIdRegex.exec(text)) !== null) {
      const digits = m[1].replace(/[^0-9]/g, '');
      if (digits.length >= 8 && digits.length <= 15) idSet.add(digits);
    }
    explicitIdRegex.lastIndex = 0;
    while ((m = explicitIdRegex.exec(text)) !== null) {
      const digits = m[1].replace(/[^0-9]/g, '');
      if (digits.length >= 8 && digits.length <= 15) idSet.add(digits);
    }
  }

  return {
    meetingIds: Array.from(idSet),
    normalizedUrls: Array.from(urlSet)
  };
}

function parseGoogleCalendarCleanupEvent(raw: any): GoogleCalendarCleanupEvent | null {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (raw.status === 'cancelled') return null;

  const privatePropsRaw = raw.extendedProperties?.private;
  const privateExtendedProperties: Record<string, string> = {};
  if (privatePropsRaw && typeof privatePropsRaw === 'object') {
    for (const [k, v] of Object.entries(privatePropsRaw)) {
      if (typeof v === 'string') privateExtendedProperties[k] = v;
    }
  }

  const conferenceJoinUrls: string[] = [];
  const entryPoints = raw.conferenceData?.entryPoints;
  if (Array.isArray(entryPoints)) {
    for (const ep of entryPoints) {
      if (typeof ep?.uri === 'string' && ep.uri.trim()) {
        conferenceJoinUrls.push(ep.uri.trim());
      }
    }
  }

  const textsToInspect = [
    typeof raw.location === 'string' ? raw.location : '',
    typeof raw.description === 'string' ? raw.description : '',
    typeof raw.hangoutLink === 'string' ? raw.hangoutLink : '',
    ...conferenceJoinUrls
  ];

  const { meetingIds, normalizedUrls } = extractZoomReferencesFromText(textsToInspect);
  if (privateExtendedProperties.zoomMeetingId) {
    const propDigits = privateExtendedProperties.zoomMeetingId.replace(/[^0-9]/g, '');
    if (propDigits.length >= 8 && !meetingIds.includes(propDigits)) {
      meetingIds.push(propDigits);
    }
  }

  return {
    id: raw.id.trim(),
    iCalUID: typeof raw.iCalUID === 'string' ? raw.iCalUID : undefined,
    summary: typeof raw.summary === 'string' ? raw.summary : '(No title)',
    location: typeof raw.location === 'string' ? raw.location : undefined,
    description: typeof raw.description === 'string' ? raw.description : undefined,
    status: typeof raw.status === 'string' ? raw.status : undefined,
    startDateTime: raw.start?.dateTime || raw.start?.date || undefined,
    endDateTime: raw.end?.dateTime || raw.end?.date || undefined,
    recurrence: Array.isArray(raw.recurrence) ? raw.recurrence.filter((r: any) => typeof r === 'string') : undefined,
    recurringEventId: typeof raw.recurringEventId === 'string' ? raw.recurringEventId : undefined,
    hangoutLink: typeof raw.hangoutLink === 'string' ? raw.hangoutLink : undefined,
    conferenceJoinUrls,
    privateExtendedProperties,
    extractedZoomMeetingIds: meetingIds,
    extractedZoomJoinUrls: normalizedUrls
  };
}

/**
 * Lists ALL non-cancelled master/standalone events from the user's primary Google Calendar
 * (`singleEvents=false` so recurring series are returned as master events rather than expanded occurrences),
 * following `nextPageToken` across all pages with bounded retries on 429/5xx.
 */
export async function listPrimaryGoogleCalendarEventsForCleanup(params: {
  accessToken: string;
  calendarId?: string;
  maxPages?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}): Promise<CalendarListCleanupEventsResult> {
  const fetchFn = customCalendarFetchForTesting || fetch;
  const calendarId = encodeURIComponent(params.calendarId || 'primary');
  const maxPages = Math.max(1, Math.min(100, params.maxPages ?? 50));
  const maxRetries = Math.max(0, Math.min(4, params.maxRetries ?? 3));
  const baseDelayMs = Math.max(0, params.retryDelayMs ?? 450);

  const byId = new Map<string, GoogleCalendarCleanupEvent>();
  const seenTokens = new Set<string>();
  let pageToken = '';
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const qs = new URLSearchParams({
      maxResults: '250',
      singleEvents: 'false',
      showDeleted: 'false'
    });
    if (pageToken) qs.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${qs.toString()}`;
    let attempt = 0;
    let res: Response | null = null;
    while (true) {
      try {
        res = await fetchFn(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            Accept: 'application/json'
          }
        });
      } catch (err: any) {
        if (attempt < maxRetries) {
          attempt++;
          await sleepCalendarMs(baseDelayMs * attempt);
          continue;
        }
        return {
          ok: false,
          status: 0,
          events: [],
          pagesFetched,
          error: sanitizeDiagnosticText(err?.message) || 'Network error while listing Google Calendar events.'
        };
      }

      if (res.status === 401) {
        clearInMemoryGoogleCalendarToken(true, params.accessToken);
        return {
          ok: false,
          status: 401,
          events: [],
          pagesFetched,
          authExpired: true,
          error: 'Google Calendar authorization expired (401). Please reconnect.'
        };
      }
      if (res.status === 403) {
        const payload = await res.json().catch(() => null);
        const classified = classifyGoogleCalendar403Error(payload);
        if (isTransient403RateLimit(classified) && attempt < maxRetries) {
          attempt++;
          const retryAfterHeader = res.headers?.get?.('Retry-After');
          const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
          await sleepCalendarMs(Math.max(retryAfterMs, baseDelayMs * attempt));
          continue;
        }
        return {
          ok: false,
          status: 403,
          events: [],
          pagesFetched,
          permissionDenied: classified.permissionDenied,
          rateLimited: classified.code === 'CALENDAR_QUOTA_EXCEEDED',
          error: classified.error
        };
      }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        attempt++;
        const retryAfterHeader = res.headers?.get?.('Retry-After');
        const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
        await sleepCalendarMs(Math.max(retryAfterMs, baseDelayMs * attempt));
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      const status = res?.status || 502;
      return {
        ok: false,
        status,
        events: [],
        pagesFetched,
        rateLimited: status === 429,
        error: `Google Calendar events.list failed (HTTP ${status}).`
      };
    }

    const json = await res.json().catch(() => ({}));
    pagesFetched++;
    const items = Array.isArray(json?.items) ? json.items : [];
    for (const rawItem of items) {
      const parsed = parseGoogleCalendarCleanupEvent(rawItem);
      if (parsed && !byId.has(parsed.id)) {
        byId.set(parsed.id, parsed);
      }
    }

    const nextTok = typeof json?.nextPageToken === 'string' ? json.nextPageToken.trim() : '';
    if (!nextTok) break;
    if (seenTokens.has(nextTok)) {
      return {
        ok: false,
        status: 502,
        events: Array.from(byId.values()),
        pagesFetched,
        error: 'Google Calendar pagination returned a repeating nextPageToken.'
      };
    }
    seenTokens.add(nextTok);
    pageToken = nextTok;
  }

  return {
    ok: true,
    status: 200,
    events: Array.from(byId.values()),
    pagesFetched
  };
}

/**
 * Matches Google Calendar events ONLY via strong deterministic/Zoom linkage signals:
 * 1. Stored `googleCalendarEventId` on a Glück session/record
 * 2. Deterministic Glück event ID (`deriveDeterministicGoogleEventId(sessionId)`)
 * 3. `extendedProperties.private.gluckSessionId` matching a known Glück session or Glück-managed tag
 * 4. Event location/description/conferenceData contains a deleted Zoom meeting ID (exact 8–15 digit match)
 * 5. Event location/description/conferenceData contains an exact deleted Zoom join URL
 * 6. Stored session/record/history Zoom meeting ID or historical Zoom join URL mapping
 *
 * NEVER matches by title similarity or date/time similarity alone.
 * Unrelated personal/school/ordinary events remain strictly untouched.
 * Events containing a Zoom link NOT in the deleted/historical set (and without Glück linkage)
 * are kept untouched and flagged for visibility as ambiguous/unlinked if they reference an unknown Zoom link.
 */
export function matchGoogleCalendarEventsToZoomCleanup(params: {
  calendarEvents: GoogleCalendarCleanupEvent[];
  targetZoomMeetingIds: Set<string>;
  targetZoomJoinUrls: Set<string>;
  sessions: GroupWeeklySession[];
  historicalZoomMeetingIds?: Set<string>;
  historicalZoomJoinUrls?: Set<string>;
  storedCalendarEventIds?: Set<string>;
  liveZoomMeetingIds?: Set<string>;
}): CalendarCleanupMatchSummary {
  const knownSessionById = new Map<string, GroupWeeklySession>();
  const storedEventIdToSessionId = new Map<string, string>();
  const deterministicEventIdToSessionId = new Map<string, string>();
  const sessionZoomIdToSessionId = new Map<string, string>();

  for (const s of params.sessions || []) {
    if (!s || !s.id) continue;
    knownSessionById.set(s.id, s);
    if (s.googleCalendarEventId) {
      storedEventIdToSessionId.set(s.googleCalendarEventId.trim(), s.id);
    }
    deterministicEventIdToSessionId.set(deriveDeterministicGoogleEventId(s.id), s.id);
    if (s.zoomMeetingId) {
      const clean = s.zoomMeetingId.replace(/[^0-9]/g, '');
      if (clean.length >= 8) sessionZoomIdToSessionId.set(clean, s.id);
    }
  }

  const normalizedTargetUrls = new Set<string>();
  const targetUrlPathKeys = new Set<string>();
  for (const raw of params.targetZoomJoinUrls || []) {
    const norm = normalizeZoomUrlForMatching(raw);
    if (norm) normalizedTargetUrls.add(norm);
    const pk = normalizeZoomUrlPathKey(raw);
    if (pk) targetUrlPathKeys.add(pk);
  }

  const normalizedHistUrls = new Set<string>();
  const histUrlPathKeys = new Set<string>();
  for (const raw of params.historicalZoomJoinUrls || []) {
    const norm = normalizeZoomUrlForMatching(raw);
    if (norm) normalizedHistUrls.add(norm);
    const pk = normalizeZoomUrlPathKey(raw);
    if (pk) histUrlPathKeys.add(pk);
  }

  const liveZoomIds = params.liveZoomMeetingIds || new Set<string>();
  const matchedToDelete: CalendarCleanupEventDecision[] = [];
  const ambiguousEvents: CalendarCleanupEventDecision[] = [];
  let untouchedEventsCount = 0;

  for (const evt of params.calendarEvents || []) {
    // Skip recurring exception instances whose master series is handled directly (deleting master deletes series)
    const isRecurringSeries = Boolean(evt.recurrence && evt.recurrence.length > 0);
    const signals: CalendarCleanupMatchSignal[] = [];
    const matchedZoomIds = new Set<string>();
    let matchedSessionId: string | undefined;

    // Never delete a Calendar event pointing to a currently live Zoom meeting that will not be deleted
    const referencesLiveMeeting = evt.extractedZoomMeetingIds.some((id) => liveZoomIds.has(id));
    if (referencesLiveMeeting) {
      ambiguousEvents.push({
        eventId: evt.id,
        summary: evt.summary,
        startDateTime: evt.startDateTime,
        isRecurringSeries,
        matched: false,
        ambiguous: true,
        signals: [],
        matchedZoomMeetingIds: evt.extractedZoomMeetingIds.filter((id) => liveZoomIds.has(id)),
        reason: 'References a currently live Zoom meeting; left untouched for safety.'
      });
      untouchedEventsCount++;
      continue;
    }

    // Signal 1: Stored Google Calendar event ID on Glück session or snapshot
    if (storedEventIdToSessionId.has(evt.id) || params.storedCalendarEventIds?.has(evt.id)) {
      signals.push('stored_google_calendar_event_id');
      matchedSessionId = matchedSessionId || storedEventIdToSessionId.get(evt.id);
    }

    // Signal 2: Deterministic Glück event ID
    if (deterministicEventIdToSessionId.has(evt.id)) {
      signals.push('deterministic_gluck_event_id');
      matchedSessionId = matchedSessionId || deterministicEventIdToSessionId.get(evt.id);
    }

    // Signal 3: privateExtendedProperties.gluckSessionId
    const propSessionId = evt.privateExtendedProperties.gluckSessionId;
    if (propSessionId && propSessionId.trim()) {
      signals.push('private_extended_property_gluck_session_id');
      matchedSessionId = matchedSessionId || propSessionId.trim();
    }

    // Signal 4: Deleted Zoom meeting ID present in event
    for (const zid of evt.extractedZoomMeetingIds) {
      if (params.targetZoomMeetingIds.has(zid)) {
        if (!signals.includes('deleted_zoom_meeting_id')) signals.push('deleted_zoom_meeting_id');
        matchedZoomIds.add(zid);
        matchedSessionId = matchedSessionId || sessionZoomIdToSessionId.get(zid);
      }
    }

    // Signal 5: Exact deleted Zoom join URL present in event
    for (const zurl of evt.extractedZoomJoinUrls) {
      const pk = normalizeZoomUrlPathKey(zurl);
      if (normalizedTargetUrls.has(zurl) || (pk && targetUrlPathKeys.has(pk))) {
        if (!signals.includes('deleted_zoom_join_url')) signals.push('deleted_zoom_join_url');
      }
    }

    // Signal 6: Stored session/history Zoom ID or historical URL mapping
    for (const zid of evt.extractedZoomMeetingIds) {
      if (params.historicalZoomMeetingIds?.has(zid) || sessionZoomIdToSessionId.has(zid)) {
        if (!signals.includes('stored_session_or_history_zoom_mapping')) {
          signals.push('stored_session_or_history_zoom_mapping');
        }
        matchedZoomIds.add(zid);
        matchedSessionId = matchedSessionId || sessionZoomIdToSessionId.get(zid);
      }
    }
    for (const zurl of evt.extractedZoomJoinUrls) {
      const pk = normalizeZoomUrlPathKey(zurl);
      if (normalizedHistUrls.has(zurl) || (pk && histUrlPathKeys.has(pk))) {
        if (!signals.includes('stored_session_or_history_zoom_mapping')) {
          signals.push('stored_session_or_history_zoom_mapping');
        }
      }
    }

    if (signals.length > 0) {
      matchedToDelete.push({
        eventId: evt.id,
        summary: evt.summary,
        startDateTime: evt.startDateTime,
        isRecurringSeries,
        matched: true,
        ambiguous: false,
        signals,
        matchedZoomMeetingIds: Array.from(matchedZoomIds),
        matchedSessionId,
        reason: `Confident match via ${signals.join(', ')}`
      });
    } else {
      // Unrelated event — strictly untouched. If it references an unrecognized Zoom link (e.g. from another Zoom host),
      // surface it as an untouched ambiguous/manual-review item so the teacher sees why it was preserved.
      if (evt.extractedZoomMeetingIds.length > 0 || evt.extractedZoomJoinUrls.length > 0) {
        ambiguousEvents.push({
          eventId: evt.id,
          summary: evt.summary,
          startDateTime: evt.startDateTime,
          isRecurringSeries,
          matched: false,
          ambiguous: true,
          signals: [],
          matchedZoomMeetingIds: evt.extractedZoomMeetingIds,
          reason: 'Contains a Zoom link not found in this host cleanup inventory or Glück records; left untouched.'
        });
      }
      untouchedEventsCount++;
    }
  }

  return {
    totalEventsScanned: (params.calendarEvents || []).length,
    matchedToDelete,
    untouchedEventsCount,
    ambiguousEvents
  };
}

/**
 * Deletes a single confidently matched Google Calendar event (`DELETE /calendars/primary/events/{eventId}`).
 * - Handles 401 by invoking optional `onAuthExpiredRenew` (existing token renewal flow) once.
 * - Treats 403 as explicit failure (never deleted).
 * - On 404/410, verifies via `GET /events/{eventId}` that the event is absent or `status === 'cancelled'`
 *   before returning `alreadyDeleted: true`.
 * - Bounded retry with backoff on 429 and transient 5xx/network failures.
 */
export async function deleteGoogleCalendarEventForCleanup(params: {
  eventId: string;
  accessToken: string;
  calendarId?: string;
  onAuthExpiredRenew?: () => Promise<string | null>;
  maxRetries?: number;
  retryDelayMs?: number;
}): Promise<CalendarDeleteEventResult> {
  const fetchFn = customCalendarFetchForTesting || fetch;
  const calendarId = encodeURIComponent(params.calendarId || 'primary');
  const eventId = String(params.eventId || '').trim();
  if (!eventId) {
    return { ok: false, status: 400, eventId: '', deleted: false, error: 'Missing Google Calendar eventId.' };
  }

  const maxRetries = Math.max(0, Math.min(4, params.maxRetries ?? 3));
  const baseDelayMs = Math.max(0, params.retryDelayMs ?? 450);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`;

  let currentToken = params.accessToken;
  let renewedOnce = false;
  let attempt = 0;

  while (true) {
    let res: Response;
    try {
      res = await fetchFn(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${currentToken}`,
          Accept: 'application/json'
        }
      });
    } catch (err: any) {
      if (attempt < maxRetries) {
        attempt++;
        await sleepCalendarMs(baseDelayMs * attempt);
        continue;
      }
      return {
        ok: false,
        status: 0,
        eventId,
        deleted: false,
        error: sanitizeDiagnosticText(err?.message) || `Network error deleting Calendar event ${eventId}.`
      };
    }

    if (res.status === 204 || (res.status >= 200 && res.status < 300)) {
      return { ok: true, status: res.status, eventId, deleted: true, alreadyDeleted: false };
    }

    if (res.status === 401) {
      clearInMemoryGoogleCalendarToken(true, currentToken);
      if (!renewedOnce && params.onAuthExpiredRenew) {
        renewedOnce = true;
        const freshToken = await params.onAuthExpiredRenew();
        if (freshToken) {
          currentToken = freshToken;
          continue;
        }
      }
      return {
        ok: false,
        status: 401,
        eventId,
        deleted: false,
        authExpired: true,
        error: 'Google Calendar authorization expired (401). Please reconnect.'
      };
    }

    if (res.status === 403) {
      const payload = await res.json().catch(() => null);
      const classified = classifyGoogleCalendar403Error(payload);
      if (isTransient403RateLimit(classified) && attempt < maxRetries) {
        attempt++;
        const retryAfterHeader = res.headers?.get?.('Retry-After');
        const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
        await sleepCalendarMs(Math.max(retryAfterMs, baseDelayMs * attempt));
        continue;
      }
      return {
        ok: false,
        status: 403,
        eventId,
        deleted: false,
        permissionDenied: classified.permissionDenied,
        rateLimited: classified.code === 'CALENDAR_QUOTA_EXCEEDED',
        error: classified.error
      };
    }

    // 404 or 410: verify via GET before declaring already deleted
    if (res.status === 404 || res.status === 410) {
      try {
        const verifyRes = await fetchFn(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: 'application/json'
          }
        });
        if (verifyRes.status === 404 || verifyRes.status === 410) {
          return { ok: true, status: verifyRes.status, eventId, deleted: true, alreadyDeleted: true };
        }
        if (verifyRes.ok) {
          const evtJson = await verifyRes.json().catch(() => ({}));
          if (evtJson?.status === 'cancelled') {
            return { ok: true, status: 410, eventId, deleted: true, alreadyDeleted: true };
          }
          return {
            ok: false,
            status: 409,
            eventId,
            deleted: false,
            error: `Google Calendar DELETE returned ${res.status} for event ${eventId}, but GET verification shows it still exists.`
          };
        }
        return {
          ok: false,
          status: verifyRes.status,
          eventId,
          deleted: false,
          authExpired: verifyRes.status === 401,
          permissionDenied: verifyRes.status === 403,
          error: `Unable to verify ${res.status} deletion for Calendar event ${eventId} (GET HTTP ${verifyRes.status}).`
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          eventId,
          deleted: false,
          error: sanitizeDiagnosticText(err?.message) || `Network error verifying Calendar event ${eventId} deletion.`
        };
      }
    }

    if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
      attempt++;
      const retryAfterHeader = res.headers?.get?.('Retry-After');
      const retryAfterMs = retryAfterHeader ? Math.min(4000, Number(retryAfterHeader) * 1000 || 0) : 0;
      await sleepCalendarMs(Math.max(retryAfterMs, baseDelayMs * attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status,
      eventId,
      deleted: false,
      rateLimited: res.status === 429,
      error: `Failed to delete Google Calendar event ${eventId} (HTTP ${res.status}).`
    };
  }
}
