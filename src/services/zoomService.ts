import {
  Group,
  GroupWeeklySession,
  ZoomMeetingRecord,
  ZoomMeetingHistory,
  ZoomHistoryAction,
  GrainRecordingMatch
} from '../types';
import { auth } from '../shared/firebaseCloudSync';
import { isAndroidNativePlatform } from '../shared/googleCredentialAuthPlugin';
import {
  __getZoomNativeTestAdapter,
  ZoomNativeResponse,
  invokeAndroidZoomConnect,
  invokeAndroidZoomCreateMeeting,
  invokeAndroidZoomDeleteMeeting,
  invokeAndroidZoomDisconnect,
  invokeAndroidZoomGetMeeting,
  invokeAndroidZoomGetStatus,
  invokeAndroidZoomListMeetings,
  invokeAndroidZoomTestConnection,
  invokeAndroidZoomUpdateMeeting,
  invokeAndroidZoomUpdateSettings
} from '../shared/zoomSecureBridgePlugin';
import {
  DEFAULT_ZOOM_TIMEZONE,
  buildZoomMeetingRecordFromSession,
  computeNextSessionStartWallTime,
  extractNumericZoomMeetingId,
  normalize24HourTime,
  normalizeCanonicalZoomJoinUrl,
  reconcileGroupWeeklySessions,
  toZoomWeeklyDayNumber
} from './zoomSessionStandardizer';
import { storage } from './storageService';

export type ZoomRuntimeType = 'android' | 'electron' | 'web';

export interface ZoomUiMetaState {
  defaultTimezone: string;
  connected: boolean;
  hasCredentials: boolean;
  maskedAccountId: string | null;
  maskedClientId: string | null;
  planType: 'basic' | 'licensed' | 'unknown';
  isBasicPlan: boolean;
  maxMeetingMinutes: number | null;
  hostEmail: string | null;
  lastTestedAt: string | null;
  lastMigrationAt: string | null;
  lastError: string | null;
}

export interface ZoomVerifiedMeetingCandidate {
  zoomMeetingId: string;
  topic: string;
  joinUrl: string;
  meetingPasscode?: string;
  type?: number;
  startTime?: string;
  duration?: number;
  timezone?: string;
  recurrenceWeeklyDays?: string;
  recurrenceRepeatInterval?: number;
  matchConfidence: 'verified_strong' | 'topic_only_ambiguous' | 'schedule_mismatch';
  reasons: string[];
}

export interface ZoomAmbiguousMatchItem {
  sessionId: string;
  sessionCode: string;
  standardizedTitle: string;
  reason: string;
  candidates: ZoomVerifiedMeetingCandidate[];
}

export interface ZoomPersistenceVerificationResult {
  ok: boolean;
  verified: boolean;
  error?: string;
  sessions?: GroupWeeklySession[];
  records?: ZoomMeetingRecord[];
  history?: ZoomMeetingHistory[];
  matches?: GrainRecordingMatch[];
}

export interface ZoomMigrationPreviewItem {
  sessionId: string;
  sessionCode: string;
  groupId: string;
  groupName: string;
  weekdayName: string;
  startTime: string;
  durationMinutes: number;
  standardizedTitle: string;
  action:
    | 'create_new'
    | 'verify_existing_pending'
    | 'replace_manual_with_standardized'
    | 'update_standardized'
    | 'already_standardized';
  syncState?: GroupWeeklySession['syncState'];
  meetingSource?: GroupWeeklySession['meetingSource'];
  previousZoomUrl?: string;
  previousZoomMeetingId?: string;
  willArchivePrevious: boolean;
  planWarning40Min: boolean;
}

export interface ZoomMigrationPreviewSummary {
  totalOnlineGroups: number;
  groupsMissingSchedule: Array<{ groupId: string; groupName: string }>;
  items: ZoomMigrationPreviewItem[];
  counts: {
    createNew: number;
    verifyExistingPending: number;
    replaceManual: number;
    updateStandardized: number;
    alreadyStandardized: number;
    willArchivePrevious: number;
    planWarningCount: number;
  };
  reconciledSessions: GroupWeeklySession[];
  reconciledHistory: ZoomMeetingHistory[];
}

export interface ZoomBulkMigrationProgress {
  completed: number;
  total: number;
  currentSessionId?: string;
  currentTitle?: string;
  succeeded: number;
  linkedExisting?: number;
  ambiguous?: number;
  skipped: number;
  failed: number;
  rateLimited: boolean;
}

export interface ZoomBulkMigrationResult {
  completed: boolean;
  noOp: boolean;
  aborted: boolean;
  rateLimited: boolean;
  succeededCount: number;
  linkedExistingCount: number;
  createdCount: number;
  updatedCount: number;
  ambiguousCount: number;
  ambiguousItems: ZoomAmbiguousMatchItem[];
  skippedCount: number;
  failedCount: number;
  archivedPreviousCount: number;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  errors: Array<{ sessionId: string; title: string; error: string }>;
  processedSessionIds: string[];
  persistenceVerified?: boolean;
  persistenceError?: string;
}

export const ZOOM_UI_META_STORAGE_KEY = 'glueck_zoom_ui_meta_v1';
export const GROUP_WEEKLY_SESSIONS_STORAGE_KEY = 'glueck_group_weekly_sessions_v1';
export const ZOOM_MEETING_RECORDS_STORAGE_KEY = 'glueck_zoom_meeting_records_v1';
export const ZOOM_MEETING_HISTORY_STORAGE_KEY = 'glueck_zoom_meeting_history_v1';
export const GRAIN_RECORDING_MATCHES_STORAGE_KEY = 'glueck_grain_recording_matches_v1';

// Strictly in-memory session token & test hook (never persisted)
let cachedZoomLoopbackSessionToken: string | null = null;
let inMemorySessionsFallback: GroupWeeklySession[] = [];
let inMemoryRecordsFallback: ZoomMeetingRecord[] = [];
let inMemoryHistoryFallback: ZoomMeetingHistory[] = [];
let inMemoryMatchesFallback: GrainRecordingMatch[] = [];

export type ZoomProxyFetchFn = (url: string, init?: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  headers?: { get: (k: string) => string | null };
}>;

let customZoomProxyFetchForTesting: ZoomProxyFetchFn | null = null;
let inMemoryZoomUiMetaFallback: ZoomUiMetaState | null = null;

export function __setZoomProxyFetchForTesting(fn: ZoomProxyFetchFn | null): void {
  customZoomProxyFetchForTesting = fn;
}

export function __resetZoomServiceMemoryForTesting(): void {
  cachedZoomLoopbackSessionToken = null;
  inMemoryZoomUiMetaFallback = null;
  inMemorySessionsFallback = [];
  inMemoryRecordsFallback = [];
  inMemoryHistoryFallback = [];
  inMemoryMatchesFallback = [];
}

/**
 * Strips invisible Unicode directional/zero-width marks, surrounding quotes, and whitespace
 * commonly introduced by Android/Arabic mobile clipboards.
 */
export function normalizeZoomCredentialInput(rawInput: unknown): string {
  let str = String(rawInput ?? '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/g, '')
    .trim();
  str = str.replace(/^["'`]+|["'`]+$/g, '').trim();
  return str.replace(/\s+/g, '');
}

export function detectZoomRuntime(): ZoomRuntimeType {
  if (__getZoomNativeTestAdapter()?.isAndroidNative?.()) {
    return 'android';
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.electronBridge && win.electronBridge.isElectron && win.electronBridge.zoom) {
      return 'electron';
    }
    if (isAndroidNativePlatform()) {
      return 'android';
    }
  }
  return 'web';
}

/**
 * Strips any accidental Zoom secrets, OAuth tokens, or short-lived zak start_url strings.
 */
export function redactZoomSecrets(input: unknown): string {
  const raw = typeof input === 'string' ? input : String((input as any)?.message || input || '');
  return raw
    .replace(/([?&]zak=)[^&\s"']+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]')
    .replace(/(client_?secret["':=\s]+)[^\s"',}]+/gi, '$1[REDACTED]');
}

export function getDefaultZoomUiMeta(): ZoomUiMetaState {
  return {
    defaultTimezone: DEFAULT_ZOOM_TIMEZONE,
    connected: false,
    hasCredentials: false,
    maskedAccountId: null,
    maskedClientId: null,
    planType: 'unknown',
    isBasicPlan: false,
    maxMeetingMinutes: null,
    hostEmail: null,
    lastTestedAt: null,
    lastMigrationAt: null,
    lastError: null
  };
}

export function loadZoomUiMeta(): ZoomUiMetaState {
  const base = getDefaultZoomUiMeta();
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return inMemoryZoomUiMetaFallback ? { ...inMemoryZoomUiMetaFallback } : base;
  }
  try {
    const raw = localStorage.getItem(ZOOM_UI_META_STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      defaultTimezone: typeof parsed.defaultTimezone === 'string' && parsed.defaultTimezone.trim()
        ? parsed.defaultTimezone.trim()
        : DEFAULT_ZOOM_TIMEZONE,
      connected: Boolean(parsed.connected),
      hasCredentials: Boolean(parsed.hasCredentials),
      maskedAccountId: typeof parsed.maskedAccountId === 'string' ? redactZoomSecrets(parsed.maskedAccountId) : null,
      maskedClientId: typeof parsed.maskedClientId === 'string' ? redactZoomSecrets(parsed.maskedClientId) : null,
      planType: parsed.planType === 'basic' || parsed.planType === 'licensed' ? parsed.planType : 'unknown',
      isBasicPlan: Boolean(parsed.isBasicPlan),
      maxMeetingMinutes: typeof parsed.maxMeetingMinutes === 'number' ? parsed.maxMeetingMinutes : null,
      hostEmail: typeof parsed.hostEmail === 'string' ? parsed.hostEmail : null,
      lastTestedAt: typeof parsed.lastTestedAt === 'string' ? parsed.lastTestedAt : null,
      lastMigrationAt: typeof parsed.lastMigrationAt === 'string' ? parsed.lastMigrationAt : null,
      lastError: typeof parsed.lastError === 'string' ? redactZoomSecrets(parsed.lastError) : null
    };
  } catch {
    return base;
  }
}

export function saveZoomUiMeta(patch: Partial<ZoomUiMetaState>): ZoomUiMetaState {
  const current = loadZoomUiMeta();
  const next: ZoomUiMetaState = {
    ...current,
    ...patch,
    defaultTimezone: (patch.defaultTimezone !== undefined ? patch.defaultTimezone : current.defaultTimezone) || DEFAULT_ZOOM_TIMEZONE,
    lastError: patch.lastError !== undefined ? (patch.lastError ? redactZoomSecrets(patch.lastError) : null) : current.lastError
  };

  inMemoryZoomUiMetaFallback = { ...next };

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      // Strictly non-secret metadata only
      const safeMeta: ZoomUiMetaState = {
        defaultTimezone: next.defaultTimezone,
        connected: next.connected,
        hasCredentials: next.hasCredentials,
        maskedAccountId: next.maskedAccountId,
        maskedClientId: next.maskedClientId,
        planType: next.planType,
        isBasicPlan: next.isBasicPlan,
        maxMeetingMinutes: next.maxMeetingMinutes,
        hostEmail: next.hostEmail,
        lastTestedAt: next.lastTestedAt,
        lastMigrationAt: next.lastMigrationAt,
        lastError: next.lastError
      };
      localStorage.setItem(ZOOM_UI_META_STORAGE_KEY, JSON.stringify(safeMeta));
    } catch {
      // Ignore storage error
    }
  }
  return next;
}

export function sanitizeZoomRecordForStorage<T>(item: T): T {
  if (!item || typeof item !== 'object') return item;
  const clone: Record<string, any> = {};
  const forbidden = new Set([
    'startUrl',
    'start_url',
    'zoomClientSecret',
    'clientSecret',
    'zoomAccessToken',
    'accessToken',
    'refreshToken',
    'refresh_token',
    'idToken',
    'id_token',
    'oauthCode',
    'zoomAccountId',
    'accountId',
    'clientId',
    'zak',
    'transcript',
    'rawTranscript',
    'transcriptText',
    'plainText',
    'grainApiToken'
  ]);
  for (const [k, v] of Object.entries(item as Record<string, any>)) {
    if (forbidden.has(k)) continue;
    if (typeof v === 'string') {
      clone[k] = redactZoomSecrets(v);
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      clone[k] = sanitizeZoomRecordForStorage(v);
    } else {
      clone[k] = v;
    }
  }
  return clone as T;
}

export async function loadGroupWeeklySessions(): Promise<GroupWeeklySession[]> {
  try {
    const raw = await storage.getItem(GROUP_WEEKLY_SESSIONS_STORAGE_KEY);
    if (Array.isArray(raw)) {
      inMemorySessionsFallback = raw.map(sanitizeZoomRecordForStorage);
      return inMemorySessionsFallback;
    }
  } catch {
    // fallback below
  }
  return inMemorySessionsFallback;
}

export async function saveGroupWeeklySessions(items: GroupWeeklySession[]): Promise<GroupWeeklySession[]> {
  const clean = (Array.isArray(items) ? items : []).map(sanitizeZoomRecordForStorage);
  await storage.setItem(GROUP_WEEKLY_SESSIONS_STORAGE_KEY, clean);
  inMemorySessionsFallback = clean;
  return clean;
}

export async function loadZoomMeetingRecords(): Promise<ZoomMeetingRecord[]> {
  try {
    const raw = await storage.getItem(ZOOM_MEETING_RECORDS_STORAGE_KEY);
    if (Array.isArray(raw)) {
      inMemoryRecordsFallback = raw.map(sanitizeZoomRecordForStorage);
      return inMemoryRecordsFallback;
    }
  } catch {}
  return inMemoryRecordsFallback;
}

export async function saveZoomMeetingRecords(items: ZoomMeetingRecord[]): Promise<ZoomMeetingRecord[]> {
  const clean = (Array.isArray(items) ? items : []).map(sanitizeZoomRecordForStorage);
  await storage.setItem(ZOOM_MEETING_RECORDS_STORAGE_KEY, clean);
  inMemoryRecordsFallback = clean;
  return clean;
}

export async function loadZoomMeetingHistory(): Promise<ZoomMeetingHistory[]> {
  try {
    const raw = await storage.getItem(ZOOM_MEETING_HISTORY_STORAGE_KEY);
    if (Array.isArray(raw)) {
      inMemoryHistoryFallback = raw.map(sanitizeZoomRecordForStorage);
      return inMemoryHistoryFallback;
    }
  } catch {}
  return inMemoryHistoryFallback;
}

export async function saveZoomMeetingHistory(items: ZoomMeetingHistory[]): Promise<ZoomMeetingHistory[]> {
  const clean = (Array.isArray(items) ? items : []).map(sanitizeZoomRecordForStorage);
  await storage.setItem(ZOOM_MEETING_HISTORY_STORAGE_KEY, clean);
  inMemoryHistoryFallback = clean;
  return clean;
}

export async function loadGrainRecordingMatches(): Promise<GrainRecordingMatch[]> {
  try {
    const raw = await storage.getItem(GRAIN_RECORDING_MATCHES_STORAGE_KEY);
    if (Array.isArray(raw)) {
      inMemoryMatchesFallback = raw.map(sanitizeZoomRecordForStorage);
      return inMemoryMatchesFallback;
    }
  } catch {}
  return inMemoryMatchesFallback;
}

/**
 * Durably persists Zoom workspace collections to storage and verifies read-back BEFORE
 * callers may claim a session is Synced. Never swallows write/read-back failures.
 */
export async function persistZoomWorkspaceDurably(snapshot: {
  sessions?: GroupWeeklySession[];
  records?: ZoomMeetingRecord[];
  history?: ZoomMeetingHistory[];
  matches?: GrainRecordingMatch[];
}): Promise<ZoomPersistenceVerificationResult> {
  const cleanSessions = snapshot.sessions
    ? snapshot.sessions.map((x) => sanitizeZoomRecordForStorage(x))
    : undefined;
  const cleanRecords = snapshot.records
    ? snapshot.records.map((x) => sanitizeZoomRecordForStorage(x))
    : undefined;
  const cleanHistory = snapshot.history
    ? snapshot.history.map((x) => sanitizeZoomRecordForStorage(x))
    : undefined;
  const cleanMatches = snapshot.matches
    ? snapshot.matches.map((x) => sanitizeZoomRecordForStorage(x))
    : undefined;

  try {
    if (cleanSessions !== undefined) {
      await storage.setItem(GROUP_WEEKLY_SESSIONS_STORAGE_KEY, cleanSessions);
      const readBackOk = await storage.verifyDurableReadBackValue<GroupWeeklySession[]>(
        GROUP_WEEKLY_SESSIONS_STORAGE_KEY,
        cleanSessions,
        (expected, actual) => {
          if (!Array.isArray(actual)) return false;
          const actualById = new Map<string, GroupWeeklySession>();
          for (const row of actual) {
            if (row && row.id) actualById.set(row.id, row);
          }
          for (const exp of expected) {
            if (!exp || exp.deleted) continue;
            const persisted = actualById.get(exp.id);
            if (!persisted || persisted.deleted) return false;
            if (persisted.syncState !== exp.syncState) return false;
            if (persisted.meetingSource !== exp.meetingSource) return false;
            if ((persisted.zoomMeetingId || '') !== (exp.zoomMeetingId || '')) return false;
            if ((persisted.zoomJoinUrl || '').trim() !== (exp.zoomJoinUrl || '').trim()) return false;
          }
          return true;
        }
      );
      if (!readBackOk) {
        return {
          ok: false,
          verified: false,
          error: 'Durable read-back verification failed for Zoom weekly sessions.'
        };
      }
      inMemorySessionsFallback = cleanSessions;
    }

    if (cleanRecords !== undefined) {
      await storage.setItem(ZOOM_MEETING_RECORDS_STORAGE_KEY, cleanRecords);
      const recordsOk = await storage.verifyDurableReadBack([ZOOM_MEETING_RECORDS_STORAGE_KEY]);
      if (!recordsOk) {
        return {
          ok: false,
          verified: false,
          error: 'Durable read-back verification failed for Zoom meeting records.'
        };
      }
      inMemoryRecordsFallback = cleanRecords;
    }

    if (cleanHistory !== undefined) {
      await storage.setItem(ZOOM_MEETING_HISTORY_STORAGE_KEY, cleanHistory);
      const historyOk = await storage.verifyDurableReadBack([ZOOM_MEETING_HISTORY_STORAGE_KEY]);
      if (!historyOk) {
        return {
          ok: false,
          verified: false,
          error: 'Durable read-back verification failed for Zoom meeting history.'
        };
      }
      inMemoryHistoryFallback = cleanHistory;
    }

    if (cleanMatches !== undefined) {
      await storage.setItem(GRAIN_RECORDING_MATCHES_STORAGE_KEY, cleanMatches);
      inMemoryMatchesFallback = cleanMatches;
    }

    return {
      ok: true,
      verified: true,
      sessions: cleanSessions,
      records: cleanRecords,
      history: cleanHistory,
      matches: cleanMatches
    };
  } catch (err: any) {
    return {
      ok: false,
      verified: false,
      error: redactZoomSecrets(err?.message || 'Failed to persist Zoom sync bindings durably.')
    };
  }
}

export async function saveGrainRecordingMatches(items: GrainRecordingMatch[]): Promise<GrainRecordingMatch[]> {
  const clean = (Array.isArray(items) ? items : []).map(sanitizeZoomRecordForStorage);
  inMemoryMatchesFallback = clean;
  if (typeof window !== 'undefined') {
    try {
      await storage.setItem(GRAIN_RECORDING_MATCHES_STORAGE_KEY, clean);
    } catch {}
  }
  return clean;
}

async function performProxyFetch(url: string, init?: RequestInit) {
  if (customZoomProxyFetchForTesting) {
    return customZoomProxyFetchForTesting(url, init);
  }
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API is unavailable in this runtime.');
  }
  return fetch(url, init);
}

async function buildZoomProxyAuthHeaders(forceRefreshSession = false): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Zoom-Local-Client': 'glueck-web'
  };

  try {
    const currentUser = auth?.currentUser;
    if (currentUser && typeof currentUser.getIdToken === 'function') {
      const idToken = await currentUser.getIdToken(forceRefreshSession);
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        if (currentUser.uid) {
          headers['X-Owner-Uid'] = currentUser.uid;
        }
        return headers;
      }
    }
  } catch {
    // Fall back to loopback teacher session
  }

  if (forceRefreshSession) {
    cachedZoomLoopbackSessionToken = null;
  }

  if (!cachedZoomLoopbackSessionToken) {
    try {
      const sessRes = await performProxyFetch('/api/zoom/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zoom-Local-Client': 'glueck-web'
        },
        body: JSON.stringify({ deviceId: 'local_teacher' })
      });
      if (sessRes.ok) {
        const parsed = await sessRes.json();
        if (parsed && typeof parsed.sessionToken === 'string') {
          cachedZoomLoopbackSessionToken = parsed.sessionToken;
        }
      }
    } catch {
      // Proxy may be unreachable when offline
    }
  }

  if (cachedZoomLoopbackSessionToken) {
    headers['X-Zoom-Session-Token'] = cachedZoomLoopbackSessionToken;
  }

  return headers;
}

function normalizeNativeZoomBridgeResult(nativeRes: ZoomNativeResponse | null | undefined): {
  ok: boolean;
  status: number;
  code?: string;
  data?: any;
  error?: string;
  retryAfterSeconds?: number;
} {
  if (!nativeRes || typeof nativeRes !== 'object') {
    return {
      ok: false,
      status: 500,
      code: 'NATIVE_BRIDGE_EMPTY',
      error: 'Native Zoom bridge returned an empty response.'
    };
  }
  const status = typeof nativeRes.httpStatus === 'number' ? nativeRes.httpStatus : nativeRes.ok ? 200 : 500;
  if (!nativeRes.ok) {
    const retrySec = nativeRes.retryAfter ? Number(nativeRes.retryAfter) || 30 : undefined;
    return {
      ok: false,
      status,
      code: nativeRes.code || (status === 429 ? 'RATE_LIMITED' : 'ZOOM_NATIVE_ERROR'),
      data: nativeRes,
      error: redactZoomSecrets(nativeRes.error || `Zoom request failed (HTTP ${status})`),
      retryAfterSeconds: retrySec
    };
  }
  return { ok: true, status, data: nativeRes };
}

async function callNativeOrElectronZoomBridge(
  runtime: 'android' | 'electron',
  path: string,
  init: RequestInit = {}
): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  data?: any;
  error?: string;
  retryAfterSeconds?: number;
}> {
  const method = String(init.method || 'GET').toUpperCase();
  let bodyObj: Record<string, any> = {};
  if (typeof init.body === 'string' && init.body.trim()) {
    try {
      bodyObj = JSON.parse(init.body);
    } catch {
      bodyObj = {};
    }
  }

  try {
    const electronZoom = runtime === 'electron' ? (window as any).electronBridge?.zoom : null;

    if (path === '/api/zoom/status' && method === 'GET') {
      const res = runtime === 'android' ? await invokeAndroidZoomGetStatus() : await electronZoom.getStatus();
      return normalizeNativeZoomBridgeResult(res);
    }
    if (path === '/api/zoom/connect' && method === 'POST') {
      const payload = {
        accountId: String(bodyObj.accountId || ''),
        clientId: String(bodyObj.clientId || ''),
        clientSecret: String(bodyObj.clientSecret || ''),
        defaultTimezone: String(bodyObj.defaultTimezone || DEFAULT_ZOOM_TIMEZONE)
      };
      const res = runtime === 'android' ? await invokeAndroidZoomConnect(payload) : await electronZoom.connect(payload);
      return normalizeNativeZoomBridgeResult(res);
    }
    if (path === '/api/zoom/test-connection' && method === 'POST') {
      const res = runtime === 'android' ? await invokeAndroidZoomTestConnection() : await electronZoom.testConnection();
      return normalizeNativeZoomBridgeResult(res);
    }
    if (path === '/api/zoom/settings' && method === 'PATCH') {
      const tz = String(bodyObj.defaultTimezone || DEFAULT_ZOOM_TIMEZONE);
      const res = runtime === 'android' ? await invokeAndroidZoomUpdateSettings(tz) : await electronZoom.updateSettings(tz);
      return normalizeNativeZoomBridgeResult(res);
    }
    if (path === '/api/zoom/disconnect' && method === 'POST') {
      const res = runtime === 'android' ? await invokeAndroidZoomDisconnect() : await electronZoom.disconnect();
      return normalizeNativeZoomBridgeResult(res);
    }
    if (path === '/api/zoom/meetings/create' && method === 'POST') {
      const payload = {
        topic: String(bodyObj.topic || ''),
        startTime: String(bodyObj.startTime || ''),
        duration: Number(bodyObj.duration) || 60,
        timezone: String(bodyObj.timezone || DEFAULT_ZOOM_TIMEZONE),
        weeklyDay: Number(bodyObj.weeklyDay) || 2,
        repeatInterval: Number(bodyObj.repeatInterval) === 2 ? 2 : 1,
        waitingRoom: bodyObj.waitingRoom === true,
        autoRecording: bodyObj.autoRecording === 'cloud' ? 'cloud' : 'none'
      };
      const res =
        runtime === 'android' ? await invokeAndroidZoomCreateMeeting(payload) : await electronZoom.createMeeting(payload);
      return normalizeNativeZoomBridgeResult(res);
    }

    if ((path === '/api/zoom/meetings' || path.startsWith('/api/zoom/meetings?')) && method === 'GET') {
      const qsRaw = path.includes('?') ? path.slice(path.indexOf('?') + 1) : '';
      const sp = new URLSearchParams(qsRaw);
      const rawType = sp.get('type') || 'scheduled';
      const listType: 'scheduled' | 'live' | 'upcoming' =
        rawType === 'live' || rawType === 'upcoming' || rawType === 'scheduled' ? rawType : 'scheduled';
      const pageSize = Math.max(1, Math.min(300, Number(sp.get('page_size')) || 300));
      const nextPageToken = sp.get('next_page_token') || undefined;
      const payload = { type: listType, pageSize, nextPageToken };
      const res =
        runtime === 'android' ? await invokeAndroidZoomListMeetings(payload) : await electronZoom.listMeetings(payload);
      return normalizeNativeZoomBridgeResult(res);
    }

    const meetingMatch = path.match(/^\/api\/zoom\/meetings\/([^/?#]+)$/);
    if (meetingMatch) {
      const meetingId = decodeURIComponent(meetingMatch[1]);
      if (method === 'PATCH') {
        const payload = {
          meetingId,
          topic: bodyObj.topic ? String(bodyObj.topic) : undefined,
          startTime: bodyObj.startTime ? String(bodyObj.startTime) : undefined,
          duration: Number(bodyObj.duration) || 60,
          timezone: String(bodyObj.timezone || DEFAULT_ZOOM_TIMEZONE),
          weeklyDay: Number(bodyObj.weeklyDay) || 2,
          repeatInterval: Number(bodyObj.repeatInterval) === 2 ? 2 : 1,
          waitingRoom: bodyObj.waitingRoom === true
        };
        const res =
          runtime === 'android' ? await invokeAndroidZoomUpdateMeeting(payload) : await electronZoom.updateMeeting(payload);
        return normalizeNativeZoomBridgeResult(res);
      }
      if (method === 'GET') {
        const res = runtime === 'android' ? await invokeAndroidZoomGetMeeting(meetingId) : await electronZoom.getMeeting(meetingId);
        return normalizeNativeZoomBridgeResult(res);
      }
      if (method === 'DELETE') {
        const res =
          runtime === 'android' ? await invokeAndroidZoomDeleteMeeting(meetingId) : await electronZoom.deleteMeeting(meetingId);
        return normalizeNativeZoomBridgeResult(res);
      }
    }

    return {
      ok: false,
      status: 400,
      code: 'UNSUPPORTED_OPERATION',
      error: `Unsupported native Zoom route: ${method} ${path}`
    };
  } catch (err: any) {
    const rawMsg = String(err?.message || err || '');
    const isUnimplemented =
      String(err?.code || '').toUpperCase() === 'UNIMPLEMENTED' ||
      /not implemented|plugin is not implemented/i.test(rawMsg);
    if (runtime === 'android' && isUnimplemented) {
      return {
        ok: false,
        status: 501,
        code: 'ANDROID_PLUGIN_UPDATE_REQUIRED',
        error:
          'Native Android ZoomSecureBridge plugin is not present in this APK build. Please install the updated Android APK containing ZoomSecureBridgePlugin.'
      };
    }
    return {
      ok: false,
      status: 0,
      code: 'NATIVE_BRIDGE_ERROR',
      error: redactZoomSecrets(rawMsg || 'Failed to invoke native Zoom secure bridge.')
    };
  }
}

async function callZoomProxyJson(
  path: string,
  init: RequestInit = {}
): Promise<{
  ok: boolean;
  status: number;
  code?: string;
  data?: any;
  error?: string;
  retryAfterSeconds?: number;
}> {
  if (!customZoomProxyFetchForTesting) {
    const runtime = detectZoomRuntime();
    if (runtime === 'android' || runtime === 'electron') {
      return callNativeOrElectronZoomBridge(runtime, path, init);
    }
  }

  try {
    let headers = await buildZoomProxyAuthHeaders(false);
    let res = await performProxyFetch(path, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {})
      }
    });

    if (res.status === 401) {
      headers = await buildZoomProxyAuthHeaders(true);
      res = await performProxyFetch(path, {
        ...init,
        headers: {
          ...headers,
          ...(init.headers || {})
        }
      });
    }

    let parsed: any = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const retryHeader = res.headers?.get?.('Retry-After');
      return {
        ok: false,
        status: res.status,
        code: parsed?.code || (res.status === 429 ? 'RATE_LIMITED' : 'ZOOM_PROXY_ERROR'),
        data: parsed,
        error: redactZoomSecrets(parsed?.error || `Zoom request failed (HTTP ${res.status})`),
        retryAfterSeconds: retryHeader ? Number(retryHeader) || 30 : undefined
      };
    }

    if (!parsed || typeof parsed !== 'object') {
      return {
        ok: false,
        status: res.status,
        code: 'NON_JSON_RESPONSE',
        error:
          `Zoom backend returned a non-JSON response (HTTP ${res.status}). On Android, ensure the updated APK with native ZoomSecureBridge is installed.`
      };
    }

    return { ok: true, status: res.status, data: parsed };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      code: 'NETWORK_ERROR',
      error: redactZoomSecrets(err?.message || 'Unable to reach Zoom backend proxy.')
    };
  }
}

export async function getZoomConnectionStatus(): Promise<ZoomUiMetaState> {
  const res = await callZoomProxyJson('/api/zoom/status', { method: 'GET' });
  if (!res.ok || !res.data) {
    return loadZoomUiMeta();
  }
  const d = res.data;
  return saveZoomUiMeta({
    hasCredentials: Boolean(d.hasCredentials),
    connected: Boolean(d.hasCredentials),
    maskedAccountId: d.maskedAccountId || null,
    maskedClientId: d.maskedClientId || null,
    defaultTimezone: d.defaultTimezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE,
    planType: d.planType || 'unknown',
    isBasicPlan: Boolean(d.isBasicPlan),
    maxMeetingMinutes: typeof d.maxMeetingMinutes === 'number' ? d.maxMeetingMinutes : null,
    hostEmail: d.hostEmail || null
  });
}

export async function connectZoomAccount(params: {
  accountId: string;
  clientId: string;
  clientSecret: string;
  defaultTimezone?: string;
}): Promise<{ ok: boolean; state: ZoomUiMetaState; error?: string }> {
  const res = await callZoomProxyJson('/api/zoom/connect', {
    method: 'POST',
    body: JSON.stringify({
      accountId: normalizeZoomCredentialInput(params.accountId),
      clientId: normalizeZoomCredentialInput(params.clientId),
      clientSecret: normalizeZoomCredentialInput(params.clientSecret),
      defaultTimezone: params.defaultTimezone?.trim() || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE
    })
  });

  if (!res.ok || !res.data?.saved) {
    const state = saveZoomUiMeta({
      connected: false,
      lastError: res.error || res.data?.error || 'Failed to connect Zoom Server-to-Server OAuth app.'
    });
    return { ok: false, state, error: state.lastError || undefined };
  }

  const d = res.data;
  const state = saveZoomUiMeta({
    connected: true,
    hasCredentials: true,
    maskedAccountId: d.maskedAccountId || null,
    maskedClientId: d.maskedClientId || null,
    defaultTimezone: d.defaultTimezone || DEFAULT_ZOOM_TIMEZONE,
    planType: d.planType || 'unknown',
    isBasicPlan: Boolean(d.isBasicPlan),
    maxMeetingMinutes: typeof d.maxMeetingMinutes === 'number' ? d.maxMeetingMinutes : null,
    hostEmail: d.hostEmail || null,
    lastTestedAt: new Date().toISOString(),
    lastError: null
  });
  return { ok: true, state };
}

export async function testZoomConnection(): Promise<{ ok: boolean; state: ZoomUiMetaState; error?: string }> {
  const res = await callZoomProxyJson('/api/zoom/test-connection', { method: 'POST', body: '{}' });
  if (!res.ok || !res.data?.connected) {
    const state = saveZoomUiMeta({
      connected: false,
      lastTestedAt: new Date().toISOString(),
      lastError: res.error || res.data?.error || 'Zoom connection test failed.'
    });
    return { ok: false, state, error: state.lastError || undefined };
  }
  const d = res.data;
  const state = saveZoomUiMeta({
    connected: true,
    hasCredentials: true,
    planType: d.planType || 'unknown',
    isBasicPlan: Boolean(d.isBasicPlan),
    maxMeetingMinutes: typeof d.maxMeetingMinutes === 'number' ? d.maxMeetingMinutes : null,
    hostEmail: d.hostEmail || null,
    defaultTimezone: d.defaultTimezone || loadZoomUiMeta().defaultTimezone,
    lastTestedAt: new Date().toISOString(),
    lastError: d.profileCheckWarning || null
  });
  return { ok: true, state };
}

export async function updateZoomDefaultTimezone(defaultTimezone: string): Promise<{ ok: boolean; state: ZoomUiMetaState; error?: string }> {
  const cleanTz = defaultTimezone.trim() || DEFAULT_ZOOM_TIMEZONE;
  const res = await callZoomProxyJson('/api/zoom/settings', {
    method: 'PATCH',
    body: JSON.stringify({ defaultTimezone: cleanTz })
  });
  const state = saveZoomUiMeta({ defaultTimezone: cleanTz });
  if (!res.ok) {
    return { ok: false, state, error: res.error };
  }
  return { ok: true, state };
}

export async function disconnectZoomAccount(): Promise<ZoomUiMetaState> {
  await callZoomProxyJson('/api/zoom/disconnect', { method: 'POST', body: '{}' });
  cachedZoomLoopbackSessionToken = null;
  return saveZoomUiMeta({
    connected: false,
    hasCredentials: false,
    maskedAccountId: null,
    maskedClientId: null,
    planType: 'unknown',
    isBasicPlan: false,
    maxMeetingMinutes: null,
    hostEmail: null,
    lastError: null
  });
}

export async function fetchHostStartUrlForSession(
  zoomMeetingId: string
): Promise<{ ok: boolean; startUrl?: string; joinUrl?: string; exists?: boolean; error?: string }> {
  const cleanId = extractNumericZoomMeetingId(zoomMeetingId);
  if (!cleanId) {
    return { ok: false, error: 'Invalid numeric Zoom Meeting ID.' };
  }
  const res = await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(cleanId)}`, {
    method: 'GET'
  });
  if (!res.ok) {
    return {
      ok: false,
      exists: res.status !== 404,
      error: res.error || 'Could not retrieve fresh host start link.'
    };
  }
  return {
    ok: true,
    exists: true,
    startUrl: typeof res.data?.startUrl === 'string' ? res.data.startUrl : undefined,
    joinUrl: typeof res.data?.joinUrl === 'string' ? res.data.joinUrl : undefined
  };
}

export function appendZoomHistoryEntry(
  history: ZoomMeetingHistory[],
  params: {
    session: GroupWeeklySession;
    action: ZoomHistoryAction;
    previousZoomMeetingId?: string;
    previousJoinUrl?: string;
    previousTopic?: string;
    newZoomMeetingId?: string;
    newJoinUrl?: string;
    newTopic?: string;
    reason?: string;
    deviceId?: string;
    nowMs?: number;
  }
): ZoomMeetingHistory[] {
  const nowMs = params.nowMs || Date.now();
  const entry: ZoomMeetingHistory = {
    id: `zmh_${params.session.id}_${nowMs}_${Math.random().toString(36).slice(2, 6)}`,
    sessionId: params.session.id,
    groupId: params.session.groupId,
    action: params.action,
    previousZoomMeetingId: params.previousZoomMeetingId,
    previousJoinUrl: params.previousJoinUrl ? redactZoomSecrets(params.previousJoinUrl) : undefined,
    previousTopic: params.previousTopic,
    newZoomMeetingId: params.newZoomMeetingId,
    newJoinUrl: params.newJoinUrl ? redactZoomSecrets(params.newJoinUrl) : undefined,
    newTopic: params.newTopic,
    reason: params.reason,
    recordedAt: new Date(nowMs).toISOString(),
    updatedAt: nowMs,
    originDeviceId: params.deviceId || 'local_device',
    originRevision: 1,
    deleted: false
  };
  return [entry, ...(history || [])].slice(0, 2000);
}

/**
 * Sets a manual Zoom fallback URL on a weekly session while archiving any previous meeting ID/URL cleanly.
 */
export function setManualZoomLinkForSession(params: {
  session: GroupWeeklySession;
  manualUrl: string;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  reason?: string;
}): {
  ok: boolean;
  error?: string;
  updatedSession?: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
} {
  const parsed = normalizeCanonicalZoomJoinUrl(params.manualUrl);
  const trimmedRaw = String(params.manualUrl || '').trim();
  if (!parsed.valid || !parsed.canonicalUrl) {
    return {
      ok: false,
      error: 'Please enter a valid Zoom meeting link (e.g. https://zoom.us/j/...).',
      sessions: params.sessions,
      records: params.records,
      history: params.history
    };
  }

  const nowMs = Date.now();
  const prevUrl = params.session.zoomJoinUrl;
  const prevId = params.session.zoomMeetingId;

  let nextHistory = params.history;
  if (prevUrl || prevId) {
    nextHistory = appendZoomHistoryEntry(nextHistory, {
      session: params.session,
      action: 'manual_override',
      previousZoomMeetingId: prevId,
      previousJoinUrl: prevUrl,
      previousTopic: params.session.standardizedTitle,
      newZoomMeetingId: parsed.meetingId,
      newJoinUrl: parsed.canonicalUrl,
      newTopic: params.session.standardizedTitle,
      reason: params.reason || 'Teacher entered manual Zoom link override',
      nowMs
    });
  }

  const zoomChangedForCalendar =
    Boolean(params.session.googleCalendarEventId || params.session.calendarSyncStatus === 'synced') &&
    (parsed.canonicalUrl !== params.session.zoomJoinUrl || parsed.meetingId !== params.session.zoomMeetingId);

  const updatedSession: GroupWeeklySession = {
    ...params.session,
    zoomMeetingId: parsed.meetingId,
    zoomJoinUrl: parsed.canonicalUrl,
    zoomPasscode: parsed.passcode,
    meetingSource: 'manual',
    syncState: 'manual',
    ...(zoomChangedForCalendar ? { calendarSyncStatus: 'needs_update' as const } : {}),
    lastError: undefined,
    updatedAt: nowMs,
    version: (params.session.version || 1) + 1,
    originRevision: (params.session.originRevision || 1) + 1
  };

  const nextSessions = params.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s));
  const nextRecords = params.records.map((r) =>
    r.sessionId === updatedSession.id && r.status === 'active'
      ? { ...r, status: 'superseded' as const, supersededByMeetingId: parsed.meetingId, updatedAt: nowMs }
      : r
  );

  return {
    ok: true,
    updatedSession,
    sessions: nextSessions,
    records: nextRecords,
    history: nextHistory
  };
}

/**
 * Creates a standardized recurring Zoom meeting (`type = 8`) for one weekly session via `/api/zoom/meetings/create`.
 * Archives any pre-existing manual/legacy/previous API link BEFORE replacing so historical recordings keep matching.
 */
export async function createOrReplaceZoomMeetingForSession(params: {
  session: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  timezone?: string;
  actionType?: ZoomHistoryAction;
  reason?: string;
  deletePreviousRemote?: boolean;
  replaceWholeGroup?: boolean;
}): Promise<{
  ok: boolean;
  rateLimited?: boolean;
  error?: string;
  updatedSession?: GroupWeeklySession;
  createdRecord?: ZoomMeetingRecord;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  archivedPrevious: boolean;
  planWarning40Min: boolean;
}> {
  const tz = params.timezone || params.session.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  const { startTimeIsoLocal } = computeNextSessionStartWallTime(
    params.session.weekday,
    params.session.startTime,
    tz,
    undefined,
    params.session.recurrence
  );
  const repeatInterval = params.session.recurrence === 'biweekly_a' || params.session.recurrence === 'biweekly_b' ? 2 : 1;

  const res = await callZoomProxyJson('/api/zoom/meetings/create', {
    method: 'POST',
    body: JSON.stringify({
      topic: params.session.standardizedTitle,
      startTime: startTimeIsoLocal,
      duration: params.session.durationMinutes,
      timezone: tz,
      weeklyDay: toZoomWeeklyDayNumber(params.session.weekday),
      repeatInterval,
      waitingRoom: false
    })
  });

  if (!res.ok || !res.data?.zoomMeetingId || !res.data?.joinUrl) {
    const nowMs = Date.now();
    const erroredSession: GroupWeeklySession = {
      ...params.session,
      syncState: 'error',
      lastError: res.error || 'Failed to create Zoom meeting.',
      updatedAt: nowMs
    };
    return {
      ok: false,
      rateLimited: res.status === 429 || res.code === 'RATE_LIMITED',
      error: res.error || 'Failed to create Zoom meeting.',
      sessions: params.sessions.map((s) => (s.id === params.session.id ? erroredSession : s)),
      records: params.records,
      history: params.history,
      archivedPrevious: false,
      planWarning40Min: false
    };
  }

  const nowMs = Date.now();
  const prevId = params.session.zoomMeetingId;
  const prevUrl = params.session.zoomJoinUrl;
  const hadPrevious = Boolean(prevId || prevUrl);

  let nextHistory = params.history;
  if (hadPrevious) {
    nextHistory = appendZoomHistoryEntry(nextHistory, {
      session: params.session,
      action:
        params.actionType ||
        (params.session.meetingSource === 'manual' || params.session.meetingSource === 'legacy_migrated'
          ? 'migrated_replace'
          : 'regenerated'),
      previousZoomMeetingId: prevId,
      previousJoinUrl: prevUrl,
      previousTopic: params.session.standardizedTitle,
      newZoomMeetingId: String(res.data.zoomMeetingId),
      newJoinUrl: String(res.data.joinUrl),
      newTopic: String(res.data.topic || params.session.standardizedTitle),
      reason: params.reason || 'Created standardized recurring Zoom meeting',
      nowMs
    });
  } else {
    nextHistory = appendZoomHistoryEntry(nextHistory, {
      session: params.session,
      action: 'created',
      newZoomMeetingId: String(res.data.zoomMeetingId),
      newJoinUrl: String(res.data.joinUrl),
      newTopic: String(res.data.topic || params.session.standardizedTitle),
      reason: params.reason || 'Created standardized recurring Zoom meeting',
      nowMs
    });
  }

  // Optionally delete previous API-managed meeting only if explicitly requested and it differs from new
  if (
    params.deletePreviousRemote &&
    prevId &&
    prevId !== String(res.data.zoomMeetingId) &&
    params.session.meetingSource === 'zoom_api'
  ) {
    await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(prevId)}`, { method: 'DELETE' });
  }

  const uiMeta = loadZoomUiMeta();
  const planWarning40Min = Boolean(res.data.planWarning40Min || (uiMeta.isBasicPlan && params.session.durationMinutes >= 41));

  const newJoinUrl = String(res.data.joinUrl);
  const newMeetingId = String(res.data.zoomMeetingId);
  const newPasscode = typeof res.data.meetingPasscode === 'string' ? res.data.meetingPasscode : undefined;
  const zoomChangedForCalendar =
    Boolean(params.session.googleCalendarEventId || params.session.calendarSyncStatus === 'synced') &&
    (newJoinUrl !== params.session.zoomJoinUrl ||
      newMeetingId !== params.session.zoomMeetingId ||
      newPasscode !== params.session.zoomPasscode);

  const updatedSession: GroupWeeklySession = {
    ...params.session,
    timezone: tz,
    zoomMeetingId: newMeetingId,
    zoomJoinUrl: newJoinUrl,
    zoomPasscode: newPasscode,
    zoomHostEmail: typeof res.data.hostEmail === 'string' ? res.data.hostEmail : uiMeta.hostEmail || undefined,
    meetingSource: 'zoom_api',
    syncState: 'synced',
    lastSyncedAt: new Date(nowMs).toISOString(),
    ...(zoomChangedForCalendar ? { calendarSyncStatus: 'needs_update' as const } : {}),
    lastError: undefined,
    planWarning40Min,
    updatedAt: nowMs,
    version: (params.session.version || 1) + 1,
    originRevision: (params.session.originRevision || 1) + 1
  };

  const createdRecord = buildZoomMeetingRecordFromSession(updatedSession, {
    zoomMeetingId: updatedSession.zoomMeetingId!,
    joinUrl: updatedSession.zoomJoinUrl!,
    meetingPasscode: updatedSession.zoomPasscode,
    hostEmail: updatedSession.zoomHostEmail,
    isBasicPlan: uiMeta.isBasicPlan || planWarning40Min,
    nowMs
  });

  // Only replace other slots of the same group if explicitly requested; default is strictly per-slot isolation.
  const replaceWholeGroup = params.replaceWholeGroup === true;
  const hasTargetSession = params.sessions.some((s) => s.id === updatedSession.id);
  const baseSessions = hasTargetSession ? params.sessions : [...params.sessions, updatedSession];
  const nextSessions = baseSessions.map((s) => {
    if (s.id === updatedSession.id) return updatedSession;
    if (!replaceWholeGroup || s.groupId !== updatedSession.groupId || s.deleted) return s;
    const calendarNeedsUpdate = Boolean(s.googleCalendarEventId || s.calendarSyncStatus === 'synced');
    return {
      ...s,
      zoomMeetingId: newMeetingId,
      zoomJoinUrl: newJoinUrl,
      zoomPasscode: newPasscode,
      zoomHostEmail: updatedSession.zoomHostEmail,
      meetingSource: 'zoom_api' as const,
      syncState: 'synced' as const,
      lastSyncedAt: new Date(nowMs).toISOString(),
      ...(calendarNeedsUpdate ? { calendarSyncStatus: 'needs_update' as const } : {}),
      lastError: undefined,
      updatedAt: nowMs,
      version: (s.version || 1) + 1,
      originRevision: (s.originRevision || 1) + 1
    };
  });
  const groupHistory = replaceWholeGroup
    ? params.sessions
        .filter((s) => s.groupId === updatedSession.groupId && s.id !== updatedSession.id && !s.deleted && (s.zoomMeetingId || s.zoomJoinUrl))
        .reduce((history, previousSession) => appendZoomHistoryEntry(history, {
          session: previousSession,
          action: 'regenerated',
          previousZoomMeetingId: previousSession.zoomMeetingId,
          previousJoinUrl: previousSession.zoomJoinUrl,
          previousTopic: previousSession.standardizedTitle,
          newZoomMeetingId: newMeetingId,
          newJoinUrl,
          newTopic: updatedSession.standardizedTitle,
          reason: 'Group-wide canonical Zoom link replacement',
          nowMs
        }), nextHistory)
    : nextHistory;
  const nextRecords = [
    ...params.records.map((r) => {
      const matchesTarget = replaceWholeGroup
        ? r.groupId === updatedSession.groupId
        : r.sessionId === updatedSession.id;
      return matchesTarget && r.status === 'active'
        ? { ...r, status: 'superseded' as const, supersededByMeetingId: createdRecord.zoomMeetingId, updatedAt: nowMs }
        : r;
    }),
    createdRecord
  ];

  return {
    ok: true,
    updatedSession,
    createdRecord,
    sessions: nextSessions,
    records: nextRecords,
    history: groupHistory,
    archivedPrevious: hadPrevious,
    planWarning40Min
  };
}

interface RemoteInspectedZoomMeeting {
  zoomMeetingId: string;
  topic: string;
  joinUrl: string;
  meetingPasscode?: string;
  type?: number;
  startTime?: string;
  duration?: number;
  timezone?: string;
  recurrence?: {
    type?: number;
    repeatInterval?: number;
    weeklyDays?: string;
  };
  occurrences?: Array<{
    occurrenceId?: string;
    startTime?: string;
    duration?: number;
    status?: string;
  }>;
}

function normalizeZoomTopicForComparison(topic?: string | null): string {
  return String(topic || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

const EN_SHORT_WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

function extractZonedWeekdayAndTime(
  rawStartTime: string | undefined,
  timeZone: string
): { weekday: number; timeHm: string } | null {
  const raw = String(rawStartTime || '').trim();
  if (!raw) return null;

  // Wall-clock local ISO without offset (e.g. "2026-11-16T19:00:00")
  const wallMatch = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(raw);
  if (wallMatch) {
    const y = Number(wallMatch[1]);
    const mo = Number(wallMatch[2]) - 1;
    const da = Number(wallMatch[3]);
    const dt = new Date(Date.UTC(y, mo, da, 12, 0, 0));
    if (!Number.isNaN(dt.getTime())) {
      return {
        weekday: dt.getUTCDay(),
        timeHm: `${wallMatch[4]}:${wallMatch[5]}`
      };
    }
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || DEFAULT_ZOOM_TIMEZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    });
    const parts = formatter.formatToParts(parsed);
    const wk = parts.find((p) => p.type === 'weekday')?.value || '';
    const hr = parts.find((p) => p.type === 'hour')?.value || '';
    const mi = parts.find((p) => p.type === 'minute')?.value || '';
    const weekday = EN_SHORT_WEEKDAY_TO_INDEX[wk];
    if (typeof weekday !== 'number' || !hr || !mi) return null;
    const normHr = hr === '24' ? '00' : hr.padStart(2, '0');
    return { weekday, timeHm: `${normHr}:${mi.padStart(2, '0')}` };
  } catch {
    return null;
  }
}

function parseZoomWeeklyDays(raw?: string): number[] {
  if (!raw) return [];
  return String(raw)
    .split(/[,\s]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
}

/**
 * Strictly evaluates whether an existing remote Zoom meeting matches a GroupWeeklySession.
 * Name/topic match alone is NEVER sufficient for automatic linking — requires recurring type (8)
 * plus verified weekday/time/duration agreement.
 */
export function evaluateRemoteZoomMeetingMatch(
  session: GroupWeeklySession,
  remote: RemoteInspectedZoomMeeting,
  fallbackTimezone = DEFAULT_ZOOM_TIMEZONE
): ZoomVerifiedMeetingCandidate {
  const reasons: string[] = [];
  const topicMatch =
    Boolean((remote.topic || '').trim()) &&
    normalizeZoomTopicForComparison(remote.topic) ===
      normalizeZoomTopicForComparison(session.standardizedTitle);

  const expectedZoomDay = toZoomWeeklyDayNumber(session.weekday);
  const expectedTimeHm = normalize24HourTime(session.startTime, session.startTime);
  const expectedRepeatInterval: 1 | 2 =
    session.recurrence === 'biweekly_a' || session.recurrence === 'biweekly_b' ? 2 : 1;
  const effectiveTz = remote.timezone || session.timezone || fallbackTimezone || DEFAULT_ZOOM_TIMEZONE;

  const weeklyDays = parseZoomWeeklyDays(remote.recurrence?.weeklyDays);
  const rawOccurrenceStart = remote.startTime || remote.occurrences?.[0]?.startTime;
  const zonedStart = extractZonedWeekdayAndTime(rawOccurrenceStart, effectiveTz);
  const remoteDuration =
    typeof remote.duration === 'number' && remote.duration > 0
      ? remote.duration
      : typeof remote.occurrences?.[0]?.duration === 'number' && remote.occurrences[0].duration > 0
      ? remote.occurrences[0].duration
      : undefined;

  const hasJoinUrl = Boolean((remote.joinUrl || '').trim());
  const isRecurringType8 = remote.type === 8;
  const typeMismatch = typeof remote.type === 'number' && remote.type !== 8;
  if (typeMismatch) reasons.push(`Meeting type is ${remote.type} (expected recurring type 8)`);

  let weekdayConfirmed = false;
  let scheduleMismatch = false;

  if (weeklyDays.length > 0) {
    if (weeklyDays.includes(expectedZoomDay)) {
      weekdayConfirmed = true;
      reasons.push(`Recurrence weekday matches (${session.weekdayName})`);
    } else {
      scheduleMismatch = true;
      reasons.push(`Recurrence weekday mismatch (remote weekly_days=${weeklyDays.join(',')})`);
    }
  } else if (zonedStart) {
    if (zonedStart.weekday === session.weekday) {
      weekdayConfirmed = true;
      reasons.push(`Start weekday matches (${session.weekdayName})`);
    } else {
      scheduleMismatch = true;
      reasons.push(`Start weekday mismatch`);
    }
  }

  let timeConfirmed = false;
  if (zonedStart) {
    if (zonedStart.timeHm === expectedTimeHm) {
      timeConfirmed = true;
      reasons.push(`Start time matches (${expectedTimeHm} ${effectiveTz})`);
    } else {
      scheduleMismatch = true;
      reasons.push(`Start time mismatch (remote ${zonedStart.timeHm}, expected ${expectedTimeHm})`);
    }
  }

  if (remoteDuration !== undefined) {
    if (remoteDuration !== session.durationMinutes) {
      scheduleMismatch = true;
      reasons.push(`Duration mismatch (remote ${remoteDuration}m, expected ${session.durationMinutes}m)`);
    } else {
      reasons.push(`Duration matches (${remoteDuration}m)`);
    }
  }

  if (
    typeof remote.recurrence?.repeatInterval === 'number' &&
    remote.recurrence.repeatInterval !== expectedRepeatInterval
  ) {
    scheduleMismatch = true;
    reasons.push(
      `Repeat interval mismatch (remote ${remote.recurrence.repeatInterval}, expected ${expectedRepeatInterval})`
    );
  }

  const sessionBoundId = extractNumericZoomMeetingId(session.zoomMeetingId || session.zoomJoinUrl);
  const sameIdAsSession = Boolean(sessionBoundId && sessionBoundId === remote.zoomMeetingId);
  if (sameIdAsSession) {
    reasons.push('Meeting ID matches session record');
  }

  let matchConfidence: ZoomVerifiedMeetingCandidate['matchConfidence'] = 'schedule_mismatch';
  if (topicMatch) {
    const hasStrongScheduleProof =
      isRecurringType8 &&
      weekdayConfirmed &&
      (timeConfirmed || (weeklyDays.length > 0 && sameIdAsSession)) &&
      !scheduleMismatch &&
      !typeMismatch &&
      hasJoinUrl;

    if (hasStrongScheduleProof) {
      matchConfidence = 'verified_strong';
    } else {
      if (!isRecurringType8 && !typeMismatch) {
        reasons.push('Recurring meeting type (8) not confirmed');
      }
      if (!weekdayConfirmed) {
        reasons.push('Weekday schedule not confirmed');
      }
      if (!timeConfirmed) {
        reasons.push('Start time not confirmed');
      }
      matchConfidence = 'topic_only_ambiguous';
    }
  }

  return {
    zoomMeetingId: remote.zoomMeetingId,
    topic: remote.topic,
    joinUrl: remote.joinUrl,
    meetingPasscode: remote.meetingPasscode,
    type: remote.type,
    startTime: rawOccurrenceStart,
    duration: remoteDuration,
    timezone: remote.timezone,
    recurrenceWeeklyDays: remote.recurrence?.weeklyDays,
    recurrenceRepeatInterval: remote.recurrence?.repeatInterval,
    matchConfidence,
    reasons
  };
}

/**
 * Strictly read-only remote inspection via GET /api/zoom/meetings/:meetingId.
 * NEVER creates, modifies, or deletes remote Zoom meetings.
 */
async function inspectZoomMeetingDetails(meetingId: string): Promise<{
  ok: boolean;
  exists: boolean;
  status: number;
  rateLimited?: boolean;
  detail?: RemoteInspectedZoomMeeting;
  error?: string;
}> {
  const cleanId = extractNumericZoomMeetingId(meetingId);
  if (!cleanId) {
    return { ok: false, exists: false, status: 400, error: 'Invalid numeric Zoom meeting ID.' };
  }

  const res = await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(cleanId)}`, {
    method: 'GET'
  });

  if (res.status === 404 || res.data?.exists === false) {
    return { ok: false, exists: false, status: 404, error: res.error || 'Zoom meeting not found.' };
  }

  if (!res.ok || !res.data) {
    return {
      ok: false,
      exists: true,
      status: res.status || 502,
      rateLimited: res.status === 429 || res.code === 'RATE_LIMITED',
      error: res.error || `Failed to inspect Zoom meeting ${cleanId}.`
    };
  }

  const canonicalUrl =
    normalizeCanonicalZoomJoinUrl(res.data.joinUrl || res.data.join_url || '').canonicalUrl ||
    redactZoomSecrets(String(res.data.joinUrl || res.data.join_url || ''));

  const rawRec = res.data.recurrence;
  const recurrence =
    rawRec && typeof rawRec === 'object'
      ? {
          type: typeof rawRec.type === 'number' ? rawRec.type : undefined,
          repeatInterval:
            typeof rawRec.repeatInterval === 'number'
              ? rawRec.repeatInterval
              : typeof rawRec.repeat_interval === 'number'
              ? rawRec.repeat_interval
              : undefined,
          weeklyDays:
            rawRec.weeklyDays !== undefined && rawRec.weeklyDays !== null
              ? String(rawRec.weeklyDays)
              : rawRec.weekly_days !== undefined && rawRec.weekly_days !== null
              ? String(rawRec.weekly_days)
              : undefined
        }
      : undefined;

  const occurrences = Array.isArray(res.data.occurrences)
    ? res.data.occurrences.map((o: any) => ({
        occurrenceId: o?.occurrenceId || o?.occurrence_id,
        startTime: o?.startTime || o?.start_time,
        duration: typeof o?.duration === 'number' ? o.duration : undefined,
        status: typeof o?.status === 'string' ? o.status : undefined
      }))
    : undefined;

  return {
    ok: true,
    exists: true,
    status: res.status || 200,
    detail: {
      zoomMeetingId: extractNumericZoomMeetingId(String(res.data.zoomMeetingId || res.data.id || cleanId)) || cleanId,
      topic: String(res.data.topic || ''),
      joinUrl: canonicalUrl,
      meetingPasscode: typeof res.data.meetingPasscode === 'string' ? res.data.meetingPasscode : undefined,
      type: typeof res.data.type === 'number' ? res.data.type : undefined,
      startTime: typeof res.data.startTime === 'string' ? res.data.startTime : undefined,
      duration: typeof res.data.duration === 'number' ? res.data.duration : undefined,
      timezone: typeof res.data.timezone === 'string' ? res.data.timezone : undefined,
      recurrence,
      occurrences
    }
  };
}

/**
 * Pure, non-destructive helper that binds an existing verified (or user-selected) Zoom meeting
 * to a single weekly session slot without creating, patching, or deleting any remote Zoom meeting.
 */
export function linkVerifiedZoomMeetingToSession(params: {
  session: GroupWeeklySession;
  meeting: {
    zoomMeetingId: string;
    joinUrl: string;
    meetingPasscode?: string;
    topic?: string;
    timezone?: string;
    hostEmail?: string;
  };
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  timezone?: string;
  reason?: string;
}): {
  ok: boolean;
  updatedSession: GroupWeeklySession;
  linkedRecord: ZoomMeetingRecord;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  planWarning40Min: boolean;
} {
  const nowMs = Date.now();
  const uiMeta = loadZoomUiMeta();
  const tz = params.timezone || params.meeting.timezone || params.session.timezone || uiMeta.defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  const cleanMeetingId = extractNumericZoomMeetingId(params.meeting.zoomMeetingId) || params.meeting.zoomMeetingId;
  const parsedUrl = normalizeCanonicalZoomJoinUrl(params.meeting.joinUrl);
  const canonicalJoinUrl = parsedUrl.canonicalUrl || redactZoomSecrets(params.meeting.joinUrl);
  const passcode = params.meeting.meetingPasscode || parsedUrl.passcode || params.session.zoomPasscode;
  const planWarning40Min = Boolean(uiMeta.isBasicPlan && params.session.durationMinutes >= 41);

  const zoomChangedForCalendar =
    Boolean(params.session.googleCalendarEventId || params.session.calendarSyncStatus === 'synced') &&
    (canonicalJoinUrl !== params.session.zoomJoinUrl || cleanMeetingId !== params.session.zoomMeetingId);

  const updatedSession: GroupWeeklySession = {
    ...params.session,
    timezone: tz,
    zoomMeetingId: cleanMeetingId,
    zoomJoinUrl: canonicalJoinUrl,
    zoomPasscode: passcode,
    zoomHostEmail: params.meeting.hostEmail || uiMeta.hostEmail || params.session.zoomHostEmail,
    meetingSource: 'zoom_api',
    syncState: 'synced',
    lastSyncedAt: new Date(nowMs).toISOString(),
    ...(zoomChangedForCalendar ? { calendarSyncStatus: 'needs_update' as const } : {}),
    lastError: undefined,
    planWarning40Min,
    updatedAt: nowMs,
    version: (params.session.version || 1) + 1,
    originRevision: (params.session.originRevision || 1) + 1
  };

  const linkedRecord = buildZoomMeetingRecordFromSession(updatedSession, {
    zoomMeetingId: cleanMeetingId,
    joinUrl: canonicalJoinUrl,
    meetingPasscode: passcode,
    hostEmail: updatedSession.zoomHostEmail,
    isBasicPlan: uiMeta.isBasicPlan || planWarning40Min,
    nowMs
  });

  const nextHistory = appendZoomHistoryEntry(params.history, {
    session: params.session,
    action: 'verified_existing',
    previousZoomMeetingId: params.session.zoomMeetingId !== cleanMeetingId ? params.session.zoomMeetingId : undefined,
    previousJoinUrl: params.session.zoomJoinUrl !== canonicalJoinUrl ? params.session.zoomJoinUrl : undefined,
    previousTopic: params.session.standardizedTitle,
    newZoomMeetingId: cleanMeetingId,
    newJoinUrl: canonicalJoinUrl,
    newTopic: params.meeting.topic || params.session.standardizedTitle,
    reason: params.reason || 'Verified and linked existing standardized Zoom meeting without duplication',
    nowMs
  });

  const hasTarget = params.sessions.some((s) => s.id === updatedSession.id);
  const nextSessions = hasTarget
    ? params.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    : [...params.sessions, updatedSession];

  const nextRecords = [
    ...params.records.map((r) =>
      r.sessionId === updatedSession.id && r.status === 'active' && r.zoomMeetingId !== cleanMeetingId
        ? { ...r, status: 'superseded' as const, supersededByMeetingId: cleanMeetingId, updatedAt: nowMs }
        : r
    ).filter((r) => !(r.sessionId === updatedSession.id && r.zoomMeetingId === cleanMeetingId && r.status === 'active')),
    linkedRecord
  ];

  return {
    ok: true,
    updatedSession,
    linkedRecord,
    sessions: nextSessions,
    records: nextRecords,
    history: nextHistory,
    planWarning40Min
  };
}

/**
 * Strictly READ-ONLY recovery/verification against Zoom.
 * Checks existing session.zoomMeetingId first, then host scheduled meetings inventory.
 * NEVER creates, patches, or deletes any remote Zoom meeting.
 * Name/topic alone is NEVER auto-linked; ambiguous or name-only matches return `outcome: 'ambiguous'`.
 */
export async function verifyAndRecoverZoomMeetingForSession(params: {
  session: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  timezone?: string;
  cachedInventory?: ZoomScheduledMeetingItem[] | null;
  inventoryLoader?: () => Promise<{ ok: boolean; meetings: ZoomScheduledMeetingItem[]; unavailable?: boolean; rateLimited?: boolean; error?: string }>;
}): Promise<{
  outcome: 'verified_existing' | 'ambiguous' | 'not_found' | 'error';
  candidate?: ZoomVerifiedMeetingCandidate;
  ambiguousItem?: ZoomAmbiguousMatchItem;
  rateLimited?: boolean;
  error?: string;
}> {
  const tz = params.timezone || params.session.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  const otherBoundMeetingIds = new Set<string>(
    (params.sessions || [])
      .filter((s) => s && !s.deleted && s.id !== params.session.id && s.meetingSource === 'zoom_api' && s.syncState === 'synced' && s.zoomMeetingId)
      .map((s) => extractNumericZoomMeetingId(s.zoomMeetingId) || '')
      .filter(Boolean)
  );

  // Step 1: If session already carries a Zoom meeting ID, inspect it directly (read-only GET)
  const existingId = extractNumericZoomMeetingId(params.session.zoomMeetingId || params.session.zoomJoinUrl);
  if (existingId) {
    const inspected = await inspectZoomMeetingDetails(existingId);
    if (inspected.rateLimited) {
      return { outcome: 'error', rateLimited: true, error: inspected.error };
    }
    if (inspected.ok && inspected.detail) {
      const evaluated = evaluateRemoteZoomMeetingMatch(params.session, inspected.detail, tz);
      if (evaluated.matchConfidence === 'verified_strong') {
        if (otherBoundMeetingIds.has(evaluated.zoomMeetingId)) {
          return {
            outcome: 'ambiguous',
            ambiguousItem: {
              sessionId: params.session.id,
              sessionCode: params.session.sessionCode,
              standardizedTitle: params.session.standardizedTitle,
              reason: 'This Zoom meeting ID is already bound to another weekly session slot. Please select how to link it.',
              candidates: [evaluated]
            }
          };
        }
        return { outcome: 'verified_existing', candidate: evaluated };
      }
      if (evaluated.matchConfidence === 'topic_only_ambiguous') {
        return {
          outcome: 'ambiguous',
          ambiguousItem: {
            sessionId: params.session.id,
            sessionCode: params.session.sessionCode,
            standardizedTitle: params.session.standardizedTitle,
            reason: 'Zoom meeting topic matches, but recurring day/time/duration could not be confirmed automatically. Please choose.',
            candidates: [evaluated]
          }
        };
      }
      // If schedule_mismatch (e.g., old unstandardized legacy personal link with different topic),
      // fall through to Step 2 inventory check to see if a standardized meeting already exists on Zoom.
    }
  }

  // Step 2: Check host scheduled Zoom meetings inventory (read-only GET /api/zoom/meetings)
  let inventory: ZoomScheduledMeetingItem[] | null = params.cachedInventory ?? null;
  if (inventory === null) {
    if (params.inventoryLoader) {
      const loaded = await params.inventoryLoader();
      if (!loaded.ok) {
        if (loaded.unavailable) return { outcome: 'not_found' };
        return { outcome: 'error', rateLimited: loaded.rateLimited, error: loaded.error };
      }
      inventory = loaded.meetings;
    } else {
      const invRes = await listAllZoomScheduledMeetings({ includeLiveCheck: false, maxRetries: 1, retryDelayMs: 150 });
      if (!invRes.ok) {
        // 404 or 501 means list endpoint unavailable in minimal mock or older APK — treat as not_found cleanly
        if (invRes.status === 404 || invRes.status === 501) {
          return { outcome: 'not_found' };
        }
        return { outcome: 'error', rateLimited: invRes.rateLimited, error: invRes.error };
      }
      inventory = invRes.meetings;
    }
  }

  const targetTopicNorm = normalizeZoomTopicForComparison(params.session.standardizedTitle);
  const topicMatches = (inventory || []).filter(
    (m) => normalizeZoomTopicForComparison(m.topic) === targetTopicNorm
  );

  if (topicMatches.length === 0) {
    return { outcome: 'not_found' };
  }

  // Inspect up to 5 topic-matching meetings via read-only GET to obtain recurrence & exact schedule
  const inspectedCandidates: ZoomVerifiedMeetingCandidate[] = [];
  for (const m of topicMatches.slice(0, 5)) {
    let remoteDetail: RemoteInspectedZoomMeeting = {
      zoomMeetingId: m.id,
      topic: m.topic,
      joinUrl: m.joinUrl,
      type: m.type,
      startTime: m.startTime,
      duration: m.duration,
      timezone: m.timezone
    };
    const detailRes = await inspectZoomMeetingDetails(m.id);
    if (detailRes.rateLimited) {
      return { outcome: 'error', rateLimited: true, error: detailRes.error };
    }
    if (detailRes.ok && detailRes.detail) {
      remoteDetail = {
        ...remoteDetail,
        ...detailRes.detail,
        joinUrl: detailRes.detail.joinUrl || remoteDetail.joinUrl,
        topic: detailRes.detail.topic || remoteDetail.topic
      };
    }
    inspectedCandidates.push(evaluateRemoteZoomMeetingMatch(params.session, remoteDetail, tz));
  }

  const unsharedStrong = inspectedCandidates.filter(
    (c) => c.matchConfidence === 'verified_strong' && !otherBoundMeetingIds.has(c.zoomMeetingId)
  );

  // Auto-link ONLY when there is exactly 1 matching remote meeting AND it is verified_strong
  if (topicMatches.length === 1 && inspectedCandidates.length === 1 && unsharedStrong.length === 1) {
    return {
      outcome: 'verified_existing',
      candidate: unsharedStrong[0]
    };
  }

  return {
    outcome: 'ambiguous',
    ambiguousItem: {
      sessionId: params.session.id,
      sessionCode: params.session.sessionCode,
      standardizedTitle: params.session.standardizedTitle,
      reason:
        topicMatches.length > 1
          ? `Found ${topicMatches.length} Zoom meetings matching "${params.session.standardizedTitle}". Please choose which meeting to link.`
          : `Found an existing Zoom meeting named "${params.session.standardizedTitle}", but its recurring schedule could not be strictly confirmed. Please choose.`,
      candidates: inspectedCandidates
    }
  };
}

/**
 * Unified single-session sync/recovery operation:
 * - For `needs_update` API sessions with a meeting ID: updates via PATCH.
 * - For `pending` / `error` / `legacy_migrated` / missing sessions: FIRST verifies existing Zoom
 *   meetings non-destructively; links verified matches without duplication, surfaces ambiguous
 *   candidates for user selection without touching remote meetings, and creates only when absent.
 */
export async function syncOrRecoverZoomSession(params: {
  session: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  timezone?: string;
  actionType?: ZoomHistoryAction;
  reason?: string;
  cachedInventory?: ZoomScheduledMeetingItem[] | null;
  inventoryLoader?: () => Promise<{ ok: boolean; meetings: ZoomScheduledMeetingItem[]; unavailable?: boolean; rateLimited?: boolean; error?: string }>;
}): Promise<{
  ok: boolean;
  outcome: 'linked_existing' | 'created' | 'updated' | 'ambiguous' | 'error';
  rateLimited?: boolean;
  error?: string;
  ambiguousItem?: ZoomAmbiguousMatchItem;
  updatedSession?: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  archivedPrevious: boolean;
  planWarning40Min: boolean;
}> {
  const tz = params.timezone || params.session.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;

  // Genuine schedule/title change on an already API-managed session -> PATCH update
  if (
    params.session.meetingSource === 'zoom_api' &&
    params.session.zoomMeetingId &&
    params.session.syncState === 'needs_update'
  ) {
    const upd = await updateZoomMeetingForSession({
      session: params.session,
      sessions: params.sessions,
      records: params.records,
      history: params.history,
      timezone: tz
    });
    return {
      ok: upd.ok,
      outcome: upd.ok ? 'updated' : 'error',
      rateLimited: upd.rateLimited,
      error: upd.error,
      updatedSession: upd.updatedSession,
      sessions: upd.sessions,
      records: upd.records,
      history: upd.history,
      archivedPrevious: Boolean(upd.replacedDeletedRemote),
      planWarning40Min: Boolean(upd.updatedSession?.planWarning40Min)
    };
  }

  // Non-destructive verification against existing remote Zoom meetings BEFORE creating anything!
  const verification = await verifyAndRecoverZoomMeetingForSession({
    session: params.session,
    sessions: params.sessions,
    timezone: tz,
    cachedInventory: params.cachedInventory,
    inventoryLoader: params.inventoryLoader
  });

  if (verification.outcome === 'verified_existing' && verification.candidate) {
    const linked = linkVerifiedZoomMeetingToSession({
      session: params.session,
      meeting: {
        zoomMeetingId: verification.candidate.zoomMeetingId,
        joinUrl: verification.candidate.joinUrl,
        meetingPasscode: verification.candidate.meetingPasscode,
        topic: verification.candidate.topic,
        timezone: verification.candidate.timezone || tz
      },
      sessions: params.sessions,
      records: params.records,
      history: params.history,
      timezone: tz,
      reason: 'Verified existing recurring Zoom meeting and recovered binding without creating a duplicate'
    });
    return {
      ok: true,
      outcome: 'linked_existing',
      updatedSession: linked.updatedSession,
      sessions: linked.sessions,
      records: linked.records,
      history: linked.history,
      archivedPrevious: false,
      planWarning40Min: linked.planWarning40Min
    };
  }

  if (verification.outcome === 'ambiguous' && verification.ambiguousItem) {
    return {
      ok: false,
      outcome: 'ambiguous',
      error: verification.ambiguousItem.reason,
      ambiguousItem: verification.ambiguousItem,
      sessions: params.sessions,
      records: params.records,
      history: params.history,
      archivedPrevious: false,
      planWarning40Min: false
    };
  }

  if (verification.outcome === 'error') {
    return {
      ok: false,
      outcome: 'error',
      rateLimited: verification.rateLimited,
      error: verification.error || 'Failed to verify existing Zoom meetings.',
      sessions: params.sessions,
      records: params.records,
      history: params.history,
      archivedPrevious: false,
      planWarning40Min: false
    };
  }

  // Confirmed absent on Zoom -> create a fresh standardized recurring meeting
  const created = await createOrReplaceZoomMeetingForSession({
    session: params.session,
    sessions: params.sessions,
    records: params.records,
    history: params.history,
    timezone: tz,
    actionType:
      params.actionType ||
      (params.session.zoomMeetingId || params.session.zoomJoinUrl ? 'migrated_replace' : 'created'),
    reason: params.reason
  });

  return {
    ok: created.ok,
    outcome: created.ok ? 'created' : 'error',
    rateLimited: created.rateLimited,
    error: created.error,
    updatedSession: created.updatedSession,
    sessions: created.sessions,
    records: created.records,
    history: created.history,
    archivedPrevious: created.archivedPrevious,
    planWarning40Min: created.planWarning40Min
  };
}

/**
 * Updates an existing API-managed Zoom meeting via PATCH `/api/zoom/meetings/:meetingId`.
 * If the remote Zoom meeting was deleted (404), seamlessly falls back to creating a replacement recurring meeting.
 */
export async function updateZoomMeetingForSession(params: {
  session: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  timezone?: string;
}): Promise<{
  ok: boolean;
  replacedDeletedRemote?: boolean;
  rateLimited?: boolean;
  error?: string;
  updatedSession?: GroupWeeklySession;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
}> {
  if (!params.session.zoomMeetingId || params.session.meetingSource !== 'zoom_api') {
    const created = await createOrReplaceZoomMeetingForSession({
      ...params,
      actionType: 'migrated_replace',
      reason: 'Converted session to standardized API-managed Zoom meeting'
    });
    return {
      ok: created.ok,
      rateLimited: created.rateLimited,
      error: created.error,
      updatedSession: created.updatedSession,
      sessions: created.sessions,
      records: created.records,
      history: created.history
    };
  }

  const tz = params.timezone || params.session.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  const { startTimeIsoLocal } = computeNextSessionStartWallTime(
    params.session.weekday,
    params.session.startTime,
    tz,
    undefined,
    params.session.recurrence
  );
  const repeatInterval: 1 | 2 =
    params.session.recurrence === 'biweekly_a' || params.session.recurrence === 'biweekly_b' ? 2 : 1;

  const res = await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(params.session.zoomMeetingId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      topic: params.session.standardizedTitle,
      startTime: startTimeIsoLocal,
      duration: params.session.durationMinutes,
      timezone: tz,
      weeklyDay: toZoomWeeklyDayNumber(params.session.weekday),
      repeatInterval,
      waitingRoom: false
    })
  });

  if (res.status === 404) {
    // Meeting no longer exists on Zoom: archive old link cleanly & create a fresh standardized meeting
    const replacement = await createOrReplaceZoomMeetingForSession({
      ...params,
      timezone: tz,
      actionType: 'regenerated',
      reason: 'Original Zoom meeting missing (404) — created replacement standardized meeting'
    });
    return {
      ok: replacement.ok,
      replacedDeletedRemote: replacement.ok,
      rateLimited: replacement.rateLimited,
      error: replacement.error,
      updatedSession: replacement.updatedSession,
      sessions: replacement.sessions,
      records: replacement.records,
      history: replacement.history
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      rateLimited: res.status === 429,
      error: res.error || 'Failed to update Zoom meeting.',
      sessions: params.sessions,
      records: params.records,
      history: params.history
    };
  }

  const nowMs = Date.now();
  const patchedJoinUrl = typeof res.data?.joinUrl === 'string' ? res.data.joinUrl : params.session.zoomJoinUrl;
  const timezoneChanged = tz !== params.session.timezone;
  const joinUrlChanged = patchedJoinUrl !== params.session.zoomJoinUrl;
  const updatedSession: GroupWeeklySession = {
    ...params.session,
    timezone: tz,
    ...(patchedJoinUrl ? { zoomJoinUrl: patchedJoinUrl } : {}),
    meetingSource: 'zoom_api',
    syncState: 'synced',
    lastSyncedAt: new Date(nowMs).toISOString(),
    ...((timezoneChanged || joinUrlChanged) &&
    (params.session.googleCalendarEventId || params.session.calendarSyncStatus === 'synced')
      ? { calendarSyncStatus: 'needs_update' as const }
      : {}),
    lastError: undefined,
    planWarning40Min: Boolean(res.data?.planWarning40Min),
    updatedAt: nowMs,
    version: (params.session.version || 1) + 1,
    originRevision: (params.session.originRevision || 1) + 1
  };

  const hasTargetSession = params.sessions.some((s) => s.id === updatedSession.id);
  const nextSessions = hasTargetSession
    ? params.sessions.map((s) => (s.id === updatedSession.id ? updatedSession : s))
    : [...params.sessions, updatedSession];
  const nextRecords = params.records.map((r) =>
    r.sessionId === updatedSession.id && r.status === 'active'
      ? {
          ...r,
          joinUrl: updatedSession.zoomJoinUrl || r.joinUrl,
          topic: updatedSession.standardizedTitle,
          startTime: updatedSession.startTime,
          durationMinutes: updatedSession.durationMinutes,
          timezone: tz,
          recurrenceWeeklyDay: toZoomWeeklyDayNumber(updatedSession.weekday),
          recurrenceRepeatInterval: repeatInterval,
          syncedAt: new Date(nowMs).toISOString(),
          updatedAt: nowMs
        }
      : r
  );

  return {
    ok: true,
    updatedSession,
    sessions: nextSessions,
    records: nextRecords,
    history: params.history
  };
}

/**
 * Computes a deterministic Dry-Run Migration Preview for all active online groups and their weekly sessions.
 * Does NOT call Zoom API or mutate any stored groups, lessons, attendance, grades, or payments.
 */
export function buildZoomMigrationPreview(params: {
  groups: Group[];
  existingSessions: GroupWeeklySession[];
  targetTimezone?: string;
  includePausedOrArchived?: boolean;
}): ZoomMigrationPreviewSummary {
  const tz = params.targetTimezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  const uiMeta = loadZoomUiMeta();

  let workingSessions = [...(params.existingSessions || [])];
  const collectedHistory: ZoomMeetingHistory[] = [];
  const groupsMissingSchedule: Array<{ groupId: string; groupName: string }> = [];

  const candidateGroups = (params.groups || []).filter((g) => {
    if (!g || g.deleted || g.type !== 'online') return false;
    if (!params.includePausedOrArchived && g.status === 'archived') return false;
    return true;
  });

  for (const grp of candidateGroups) {
    const rec = reconcileGroupWeeklySessions({
      group: grp,
      existingSessions: workingSessions,
      timezone: tz
    });
    workingSessions = rec.sessions;
    if (rec.historyEntries.length > 0) {
      collectedHistory.push(...rec.historyEntries);
    }
    if (rec.slotsMissingSchedule) {
      groupsMissingSchedule.push({ groupId: grp.id, groupName: grp.name });
    }
  }

  const candidateGroupIds = new Set(candidateGroups.map((g) => g.id));
  const activeSessionsForOnline = workingSessions.filter(
    (s) => s && !s.deleted && candidateGroupIds.has(s.groupId)
  );

  const items: ZoomMigrationPreviewItem[] = activeSessionsForOnline.map((s) => {
    const hasExistingUrlOrId = Boolean(s.zoomJoinUrl || s.zoomMeetingId);
    let action: ZoomMigrationPreviewItem['action'] = 'create_new';

    if (s.meetingSource === 'zoom_api' && s.zoomMeetingId && s.zoomJoinUrl) {
      if (s.syncState === 'synced') {
        action = 'already_standardized';
      } else if (s.syncState === 'pending') {
        action = 'verify_existing_pending';
      } else {
        action = 'update_standardized';
      }
    } else if (hasExistingUrlOrId) {
      action = 'replace_manual_with_standardized';
    } else {
      action = 'create_new';
    }

    return {
      sessionId: s.id,
      sessionCode: s.sessionCode,
      groupId: s.groupId,
      groupName: s.groupNameSnapshot,
      weekdayName: s.weekdayName,
      startTime: s.startTime,
      durationMinutes: s.durationMinutes,
      standardizedTitle: s.standardizedTitle,
      action,
      syncState: s.syncState,
      meetingSource: s.meetingSource,
      previousZoomUrl: s.zoomJoinUrl,
      previousZoomMeetingId: s.zoomMeetingId,
      willArchivePrevious:
        hasExistingUrlOrId &&
        action !== 'already_standardized' &&
        action !== 'update_standardized' &&
        action !== 'verify_existing_pending',
      planWarning40Min: Boolean(uiMeta.isBasicPlan && s.durationMinutes >= 41)
    };
  });

  return {
    totalOnlineGroups: candidateGroups.length,
    groupsMissingSchedule,
    items,
    counts: {
      createNew: items.filter((i) => i.action === 'create_new').length,
      verifyExistingPending: items.filter((i) => i.action === 'verify_existing_pending').length,
      replaceManual: items.filter((i) => i.action === 'replace_manual_with_standardized').length,
      updateStandardized: items.filter((i) => i.action === 'update_standardized').length,
      alreadyStandardized: items.filter((i) => i.action === 'already_standardized').length,
      willArchivePrevious: items.filter((i) => i.willArchivePrevious).length,
      planWarningCount: items.filter((i) => i.planWarning40Min).length
    },
    reconciledSessions: workingSessions,
    reconciledHistory: collectedHistory
  };
}

/**
 * Executes idempotent, checkpointed bulk Zoom meeting standardization / recovery / creation across sessions.
 * - `mode: 'standardize_all'` verifies/updates/replaces every non-synced weekly session so all online groups have standardized API-managed Zoom meetings (archiving old links in history).
 * - `mode: 'create_missing_only'` processes missing sessions AND any `pending`/`error`/`needs_update` sessions (even if they already carry a Zoom meeting ID & URL), verifying existing Zoom meetings before creating. Only skips explicitly saved `manual` overrides (`syncState === 'manual'`) and already `synced` sessions.
 * - Never returns `completed: true` when 0 sessions were actually processed (`noOp: true`).
 * - Optionally verifies durable persistence before completing.
 */
export async function executeBulkZoomMigration(params: {
  mode: 'standardize_all' | 'create_missing_only';
  preview: ZoomMigrationPreviewSummary;
  existingRecords: ZoomMeetingRecord[];
  existingHistory: ZoomMeetingHistory[];
  timezone?: string;
  skipSessionIds?: Set<string>;
  shouldAbort?: () => boolean;
  persistDurably?: boolean;
  onProgress?: (progress: ZoomBulkMigrationProgress) => void;
  onCheckpoint?: (state: {
    sessions: GroupWeeklySession[];
    records: ZoomMeetingRecord[];
    history: ZoomMeetingHistory[];
    processedSessionIds: string[];
  }) => void | Promise<void | { ok: boolean; error?: string }>;
}): Promise<ZoomBulkMigrationResult> {
  const tz = params.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  let workingSessions = [...params.preview.reconciledSessions];
  let workingRecords = [...(params.existingRecords || [])];
  let workingHistory = [...params.preview.reconciledHistory, ...(params.existingHistory || [])];

  const targetItems = params.preview.items.filter((item) => {
    if (params.skipSessionIds?.has(item.sessionId)) return false;
    if (item.action === 'already_standardized') return false;
    if (params.mode === 'create_missing_only' && item.action === 'replace_manual_with_standardized') {
      // Do NOT skip sessions that are still pending/error/needs_update even when they have ID & URL.
      // Only skip intentional manual overrides (meetingSource === 'manual' && syncState === 'manual').
      const sessionState =
        item.syncState ||
        workingSessions.find((s) => s.id === item.sessionId)?.syncState;
      if (sessionState === 'pending' || sessionState === 'error' || sessionState === 'needs_update') {
        return true;
      }
      return false;
    }
    return true;
  });

  const total = targetItems.length;
  let completed = 0;
  let succeededCount = 0;
  let linkedExistingCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let ambiguousCount = 0;
  let skippedCount = params.preview.items.length - total;
  let failedCount = 0;
  let archivedPreviousCount = 0;
  let rateLimited = false;
  let aborted = false;
  const errors: Array<{ sessionId: string; title: string; error: string }> = [];
  const ambiguousItems: ZoomAmbiguousMatchItem[] = [];
  const processedSessionIds: string[] = [];

  // Lazy cached remote inventory loader so bulk verification fetches GET /api/zoom/meetings at most once
  let inventoryCache: {
    loaded: boolean;
    ok: boolean;
    unavailable?: boolean;
    rateLimited?: boolean;
    error?: string;
    meetings: ZoomScheduledMeetingItem[];
  } | null = null;

  const loadInventoryOnce = async () => {
    if (inventoryCache?.loaded) {
      return inventoryCache;
    }
    const invRes = await listAllZoomScheduledMeetings({ includeLiveCheck: false, maxRetries: 1, retryDelayMs: 150 });
    if (!invRes.ok) {
      inventoryCache = {
        loaded: true,
        ok: false,
        unavailable: invRes.status === 404 || invRes.status === 501,
        rateLimited: invRes.rateLimited,
        error: invRes.error,
        meetings: []
      };
      return inventoryCache;
    }
    inventoryCache = {
      loaded: true,
      ok: true,
      meetings: invRes.meetings
    };
    return inventoryCache;
  };

  for (const item of targetItems) {
    if (params.shouldAbort?.()) {
      aborted = true;
      break;
    }

    const currentSession = workingSessions.find((s) => s.id === item.sessionId);
    if (!currentSession) {
      completed++;
      skippedCount++;
      continue;
    }

    params.onProgress?.({
      completed,
      total,
      currentSessionId: item.sessionId,
      currentTitle: item.standardizedTitle,
      succeeded: succeededCount,
      linkedExisting: linkedExistingCount,
      ambiguous: ambiguousCount,
      skipped: skippedCount,
      failed: failedCount,
      rateLimited
    });

    const stepRes = await syncOrRecoverZoomSession({
      session: currentSession,
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory,
      timezone: tz,
      actionType: item.willArchivePrevious ? 'migrated_replace' : 'created',
      reason:
        item.action === 'replace_manual_with_standardized'
          ? 'Bulk migration archived manual Zoom link and created standardized recurring meeting'
          : 'Bulk setup created standardized recurring Zoom meeting',
      inventoryLoader: loadInventoryOnce
    });

    workingSessions = stepRes.sessions;
    workingRecords = stepRes.records;
    workingHistory = stepRes.history;

    if (stepRes.ok) {
      succeededCount++;
      if (stepRes.outcome === 'linked_existing') linkedExistingCount++;
      else if (stepRes.outcome === 'created') createdCount++;
      else if (stepRes.outcome === 'updated') updatedCount++;
      if (stepRes.archivedPrevious) archivedPreviousCount++;
      processedSessionIds.push(item.sessionId);
    } else if (stepRes.outcome === 'ambiguous' && stepRes.ambiguousItem) {
      ambiguousCount++;
      ambiguousItems.push(stepRes.ambiguousItem);
    } else {
      failedCount++;
      errors.push({
        sessionId: item.sessionId,
        title: item.standardizedTitle,
        error: stepRes.error || 'Sync failed'
      });
      if (stepRes.rateLimited) {
        rateLimited = true;
        break;
      }
    }

    completed++;
    await params.onCheckpoint?.({
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory,
      processedSessionIds: [...processedSessionIds]
    });
  }

  let persistenceVerified: boolean | undefined;
  let persistenceError: string | undefined;

  if (params.persistDurably && succeededCount > 0) {
    const persistRes = await persistZoomWorkspaceDurably({
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory
    });
    persistenceVerified = persistRes.ok && persistRes.verified;
    if (!persistenceVerified) {
      persistenceError = persistRes.error || 'Failed to verify durable Zoom sync persistence.';
    }
  }

  if (succeededCount > 0 && persistenceVerified !== false) {
    saveZoomUiMeta({ lastMigrationAt: new Date().toISOString(), lastError: null });
  }

  const noOp = total === 0 || (succeededCount === 0 && failedCount === 0 && ambiguousCount === 0);
  const isCompleted =
    !noOp &&
    !aborted &&
    !rateLimited &&
    failedCount === 0 &&
    ambiguousCount === 0 &&
    succeededCount > 0 &&
    persistenceVerified !== false;

  return {
    completed: isCompleted,
    noOp,
    aborted,
    rateLimited,
    succeededCount,
    linkedExistingCount,
    createdCount,
    updatedCount,
    ambiguousCount,
    ambiguousItems,
    skippedCount,
    failedCount,
    archivedPreviousCount,
    sessions: workingSessions,
    records: workingRecords,
    history: workingHistory,
    errors,
    processedSessionIds,
    persistenceVerified,
    persistenceError
  };
}

export interface DisableWaitingRoomBulkResult {
  totalTargeted: number;
  updatedCount: number;
  failedCount: number;
  rateLimited: boolean;
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  errors: Array<{ sessionId: string; title: string; error: string }>;
}

/**
 * Explicitly disables Zoom Waiting Room (`waiting_room: false`) across all existing
 * active API-managed Zoom meetings via PATCH without changing meeting IDs or join URLs.
 */
export async function disableWaitingRoomForExistingZoomMeetings(params: {
  sessions: GroupWeeklySession[];
  records: ZoomMeetingRecord[];
  history: ZoomMeetingHistory[];
  timezone?: string;
  onProgress?: (progress: { completed: number; total: number; currentTitle?: string }) => void;
}): Promise<DisableWaitingRoomBulkResult> {
  const tz = params.timezone || loadZoomUiMeta().defaultTimezone || DEFAULT_ZOOM_TIMEZONE;
  let workingSessions = [...(params.sessions || [])];
  let workingRecords = [...(params.records || [])];
  let workingHistory = [...(params.history || [])];

  const targets = workingSessions.filter(
    (s) => s && !s.deleted && s.meetingSource === 'zoom_api' && Boolean(s.zoomMeetingId)
  );

  let completed = 0;
  let updatedCount = 0;
  let failedCount = 0;
  let rateLimited = false;
  const errors: Array<{ sessionId: string; title: string; error: string }> = [];

  for (const session of targets) {
    params.onProgress?.({
      completed,
      total: targets.length,
      currentTitle: session.standardizedTitle
    });

    const res = await updateZoomMeetingForSession({
      session,
      sessions: workingSessions,
      records: workingRecords,
      history: workingHistory,
      timezone: tz
    });

    workingSessions = res.sessions;
    workingRecords = res.records;
    workingHistory = res.history;

    if (res.ok) {
      updatedCount++;
    } else {
      failedCount++;
      errors.push({
        sessionId: session.id,
        title: session.standardizedTitle,
        error: res.error || 'Failed to disable Waiting Room'
      });
      if (res.rateLimited) {
        rateLimited = true;
        break;
      }
    }
    completed++;
  }

  params.onProgress?.({
    completed,
    total: targets.length
  });

  return {
    totalTargeted: targets.length,
    updatedCount,
    failedCount,
    rateLimited,
    sessions: workingSessions,
    records: workingRecords,
    history: workingHistory,
    errors
  };
}

export interface ZoomScheduledMeetingItem {
  id: string;
  uuid?: string;
  hostId?: string;
  topic: string;
  type: number;
  isRecurring: boolean;
  startTime?: string;
  duration?: number;
  timezone?: string;
  createdAt?: string;
  joinUrl: string;
  status?: string;
  isLive?: boolean;
}

export interface ZoomListMeetingsPageResult {
  ok: boolean;
  status: number;
  meetings: ZoomScheduledMeetingItem[];
  nextPageToken: string;
  pageCount: number;
  pageSize: number;
  totalRecords: number;
  hostEmail?: string | null;
  hostScope: 'single_connected_host';
  rateLimited?: boolean;
  authError?: boolean;
  permissionError?: boolean;
  error?: string;
}

export interface ZoomInventoryFetchResult {
  ok: boolean;
  status: number;
  meetings: ZoomScheduledMeetingItem[];
  liveMeetingIds: string[];
  pagesFetched: number;
  hostEmail?: string | null;
  hostScope: 'single_connected_host';
  rateLimited?: boolean;
  authError?: boolean;
  permissionError?: boolean;
  error?: string;
}

export interface ZoomDeleteMeetingResult {
  ok: boolean;
  status: number;
  meetingId: string;
  deleted: boolean;
  alreadyDeleted?: boolean;
  rateLimited?: boolean;
  authError?: boolean;
  permissionError?: boolean;
  error?: string;
}

function sleepMs(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeListedZoomMeeting(raw: any, forceLive = false): ZoomScheduledMeetingItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id ?? raw.zoomMeetingId ?? '').replace(/[^0-9]/g, '');
  if (!id) return null;
  const typeNum = Number(raw.type) || 0;
  const statusStr = typeof raw.status === 'string' ? raw.status.trim() : undefined;
  const isLive = forceLive || statusStr === 'started';
  return {
    id,
    uuid: typeof raw.uuid === 'string' && raw.uuid.trim() ? raw.uuid.trim() : undefined,
    hostId: typeof raw.hostId === 'string' ? raw.hostId : typeof raw.host_id === 'string' ? raw.host_id : undefined,
    topic: typeof raw.topic === 'string' ? redactZoomSecrets(raw.topic) : '',
    type: typeNum,
    isRecurring: typeNum === 3 || typeNum === 8,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : typeof raw.start_time === 'string' ? raw.start_time : undefined,
    duration: typeof raw.duration === 'number' ? raw.duration : undefined,
    timezone: typeof raw.timezone === 'string' ? raw.timezone : undefined,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : typeof raw.created_at === 'string' ? raw.created_at : undefined,
    joinUrl: typeof raw.joinUrl === 'string'
      ? redactZoomSecrets(raw.joinUrl)
      : typeof raw.join_url === 'string'
      ? redactZoomSecrets(raw.join_url)
      : '',
    status: statusStr,
    isLive
  };
}

/**
 * Fetches one page of Zoom meetings for the single connected host (`/v2/users/me/meetings`).
 * Uses bounded retries with backoff for HTTP 429 and transient 5xx/network failures.
 * Never masks 401/403 as empty lists.
 */
export async function listZoomScheduledMeetingsPage(params: {
  type?: 'scheduled' | 'live' | 'upcoming';
  pageSize?: number;
  nextPageToken?: string;
  maxRetries?: number;
  retryDelayMs?: number;
} = {}): Promise<ZoomListMeetingsPageResult> {
  const listType = params.type || 'scheduled';
  const pageSize = Math.max(1, Math.min(300, Number(params.pageSize) || 300));
  const maxRetries = Math.max(0, Math.min(4, params.maxRetries ?? 3));
  const baseDelayMs = Math.max(0, params.retryDelayMs ?? 450);

  const qs = new URLSearchParams({
    type: listType,
    page_size: String(pageSize)
  });
  if (params.nextPageToken && params.nextPageToken.trim()) {
    qs.set('next_page_token', params.nextPageToken.trim());
  }

  let attempt = 0;
  while (true) {
    const res = await callZoomProxyJson(`/api/zoom/meetings?${qs.toString()}`, { method: 'GET' });
    if (res.ok && res.data) {
      const rawArr = Array.isArray(res.data.meetings) ? res.data.meetings : [];
      const meetings = rawArr
        .map((m: any) => normalizeListedZoomMeeting(m, listType === 'live'))
        .filter((m: ZoomScheduledMeetingItem | null): m is ZoomScheduledMeetingItem => Boolean(m));
      return {
        ok: true,
        status: res.status || 200,
        meetings,
        nextPageToken: typeof res.data.nextPageToken === 'string'
          ? res.data.nextPageToken.trim()
          : typeof res.data.next_page_token === 'string'
          ? res.data.next_page_token.trim()
          : '',
        pageCount: Number(res.data.pageCount ?? res.data.page_count ?? 1) || 1,
        pageSize: Number(res.data.pageSize ?? res.data.page_size ?? pageSize) || pageSize,
        totalRecords: Number(res.data.totalRecords ?? res.data.total_records ?? meetings.length) || meetings.length,
        hostEmail: typeof res.data.hostEmail === 'string' ? res.data.hostEmail : null,
        hostScope: 'single_connected_host'
      };
    }

    const isTransient = res.status === 429 || res.status >= 500 || res.status === 0;
    if (isTransient && attempt < maxRetries) {
      attempt++;
      const retrySecMs = res.retryAfterSeconds ? Math.min(4000, res.retryAfterSeconds * 1000) : 0;
      await sleepMs(Math.max(retrySecMs, baseDelayMs * attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status || 502,
      meetings: [],
      nextPageToken: '',
      pageCount: 0,
      pageSize,
      totalRecords: 0,
      hostScope: 'single_connected_host',
      rateLimited: res.status === 429 || res.code === 'RATE_LIMITED',
      authError: res.status === 401,
      permissionError: res.status === 403,
      error: res.error || `Failed to list Zoom ${listType} meetings (HTTP ${res.status || 502}).`
    };
  }
}

/**
 * Fetches ALL pages of scheduled Zoom meetings for the single connected host (`type=scheduled&page_size=300`)
 * following `next_page_token` until exhausted (preserving query params on every page), AND inspects
 * `type=live` meetings so currently active live sessions are flagged and never deleted.
 */
export async function listAllZoomScheduledMeetings(options: {
  includeLiveCheck?: boolean;
  pageSize?: number;
  maxPages?: number;
  maxRetries?: number;
  retryDelayMs?: number;
} = {}): Promise<ZoomInventoryFetchResult> {
  const pageSize = Math.max(1, Math.min(300, options.pageSize ?? 300));
  const maxPages = Math.max(1, Math.min(100, options.maxPages ?? 50));
  const byId = new Map<string, ZoomScheduledMeetingItem>();
  const seenTokens = new Set<string>();
  let nextPageToken = '';
  let pagesFetched = 0;
  let hostEmail: string | null | undefined = null;

  while (pagesFetched < maxPages) {
    const page = await listZoomScheduledMeetingsPage({
      type: 'scheduled',
      pageSize,
      nextPageToken: nextPageToken || undefined,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs
    });

    if (!page.ok) {
      return {
        ok: false,
        status: page.status,
        meetings: [],
        liveMeetingIds: [],
        pagesFetched,
        hostEmail,
        hostScope: 'single_connected_host',
        rateLimited: page.rateLimited,
        authError: page.authError,
        permissionError: page.permissionError,
        error: page.error
      };
    }

    pagesFetched++;
    if (page.hostEmail) hostEmail = page.hostEmail;

    for (const meeting of page.meetings) {
      const existing = byId.get(meeting.id);
      if (!existing) {
        byId.set(meeting.id, meeting);
      } else {
        byId.set(meeting.id, {
          ...existing,
          ...meeting,
          isLive: Boolean(existing.isLive || meeting.isLive)
        });
      }
    }

    const token = (page.nextPageToken || '').trim();
    if (!token) break;
    if (seenTokens.has(token)) {
      return {
        ok: false,
        status: 502,
        meetings: Array.from(byId.values()),
        liveMeetingIds: [],
        pagesFetched,
        hostEmail,
        hostScope: 'single_connected_host',
        error: 'Zoom pagination returned a repeating next_page_token; aborting to avoid incomplete inventory.'
      };
    }
    seenTokens.add(token);
    nextPageToken = token;
  }

  // Live meeting detection so active meetings are never deleted unsafely
  const liveIds = new Set<string>();
  if (options.includeLiveCheck !== false) {
    let liveToken = '';
    const seenLiveTokens = new Set<string>();
    let livePages = 0;
    while (livePages < 20) {
      const livePage = await listZoomScheduledMeetingsPage({
        type: 'live',
        pageSize: 300,
        nextPageToken: liveToken || undefined,
        maxRetries: options.maxRetries,
        retryDelayMs: options.retryDelayMs
      });
      if (!livePage.ok) {
        // Do not silently ignore auth/permission errors during live inspection
        if (livePage.authError || livePage.permissionError) {
          return {
            ok: false,
            status: livePage.status,
            meetings: Array.from(byId.values()),
            liveMeetingIds: Array.from(liveIds),
            pagesFetched,
            hostEmail,
            hostScope: 'single_connected_host',
            authError: livePage.authError,
            permissionError: livePage.permissionError,
            error: livePage.error
          };
        }
        break;
      }
      livePages++;
      for (const lm of livePage.meetings) {
        liveIds.add(lm.id);
        const existing = byId.get(lm.id);
        if (existing) {
          byId.set(lm.id, { ...existing, isLive: true, status: 'started' });
        } else {
          byId.set(lm.id, { ...lm, isLive: true, status: 'started' });
        }
      }
      const nextTok = (livePage.nextPageToken || '').trim();
      if (!nextTok || seenLiveTokens.has(nextTok)) break;
      seenLiveTokens.add(nextTok);
      liveToken = nextTok;
    }
  }

  for (const m of byId.values()) {
    if (m.status === 'started' || m.isLive) {
      liveIds.add(m.id);
      m.isLive = true;
    }
  }

  return {
    ok: true,
    status: 200,
    meetings: Array.from(byId.values()),
    liveMeetingIds: Array.from(liveIds),
    pagesFetched,
    hostEmail,
    hostScope: 'single_connected_host'
  };
}

/**
 * Inspects a single Zoom meeting by exact string ID (`GET /api/zoom/meetings/:meetingId`).
 */
export async function inspectZoomMeetingRemote(
  meetingId: string,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<{
  ok: boolean;
  status: number;
  exists: boolean;
  isLive?: boolean;
  meeting?: { zoomMeetingId: string; topic: string; joinUrl: string; status?: string };
  rateLimited?: boolean;
  authError?: boolean;
  permissionError?: boolean;
  error?: string;
}> {
  const cleanId = extractNumericZoomMeetingId(meetingId) || String(meetingId || '').replace(/[^0-9]/g, '');
  if (cleanId.length < 8) {
    return { ok: false, status: 400, exists: false, error: 'Valid numeric Zoom meetingId is required.' };
  }
  const maxRetries = Math.max(0, Math.min(4, options.maxRetries ?? 2));
  const baseDelayMs = Math.max(0, options.retryDelayMs ?? 350);

  let attempt = 0;
  while (true) {
    const res = await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(cleanId)}`, { method: 'GET' });
    if (res.ok && res.data) {
      const statusStr = typeof res.data.status === 'string' ? res.data.status : 'waiting';
      return {
        ok: true,
        status: res.status || 200,
        exists: true,
        isLive: statusStr === 'started',
        meeting: {
          zoomMeetingId: String(res.data.zoomMeetingId || cleanId),
          topic: String(res.data.topic || ''),
          joinUrl: String(res.data.joinUrl || ''),
          status: statusStr
        }
      };
    }

    if (res.status === 404) {
      return { ok: true, status: 404, exists: false };
    }

    const isTransient = res.status === 429 || res.status >= 500 || res.status === 0;
    if (isTransient && attempt < maxRetries) {
      attempt++;
      const retrySecMs = res.retryAfterSeconds ? Math.min(4000, res.retryAfterSeconds * 1000) : 0;
      await sleepMs(Math.max(retrySecMs, baseDelayMs * attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status || 502,
      exists: true,
      rateLimited: res.status === 429 || res.code === 'RATE_LIMITED',
      authError: res.status === 401,
      permissionError: res.status === 403,
      error: res.error || `Failed to inspect Zoom meeting ${cleanId} (HTTP ${res.status || 502}).`
    };
  }
}

/**
 * Permanently deletes an entire Zoom meeting (or recurring meeting series — NEVER passing `occurrence_id`).
 * - Bounded retry with backoff on 429 and transient 5xx/network errors.
 * - On 404, verifies via `GET /api/zoom/meetings/:meetingId` before confirming `alreadyDeleted: true`.
 * - NEVER treats 401 or 403 as already deleted.
 */
export async function deleteZoomMeetingSeriesRemote(
  meetingId: string,
  options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<ZoomDeleteMeetingResult> {
  const cleanId = extractNumericZoomMeetingId(meetingId) || String(meetingId || '').replace(/[^0-9]/g, '');
  if (cleanId.length < 8) {
    return {
      ok: false,
      status: 400,
      meetingId: cleanId,
      deleted: false,
      error: 'Valid numeric Zoom meetingId is required.'
    };
  }

  const maxRetries = Math.max(0, Math.min(4, options.maxRetries ?? 3));
  const baseDelayMs = Math.max(0, options.retryDelayMs ?? 450);

  let attempt = 0;
  while (true) {
    const res = await callZoomProxyJson(`/api/zoom/meetings/${encodeURIComponent(cleanId)}`, {
      method: 'DELETE'
    });

    if (res.ok && res.data?.deleted !== false) {
      return {
        ok: true,
        status: res.status || 200,
        meetingId: cleanId,
        deleted: true,
        alreadyDeleted: false
      };
    }

    // Never treat auth/permission errors as deleted
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        status: res.status,
        meetingId: cleanId,
        deleted: false,
        authError: res.status === 401,
        permissionError: res.status === 403,
        error:
          res.error ||
          (res.status === 401
            ? 'Zoom authorization failed (401). Please verify Zoom credentials.'
            : 'Zoom permission denied (403). Ensure meeting:write:admin scope is enabled.')
      };
    }

    // 404 on DELETE: MUST verify via GET that the meeting truly does not exist before declaring already deleted
    if (res.status === 404) {
      const verified = await inspectZoomMeetingRemote(cleanId, {
        maxRetries: 1,
        retryDelayMs: baseDelayMs
      });
      if (verified.ok && !verified.exists) {
        return {
          ok: true,
          status: 404,
          meetingId: cleanId,
          deleted: true,
          alreadyDeleted: true
        };
      }
      return {
        ok: false,
        status: verified.status || 502,
        meetingId: cleanId,
        deleted: false,
        authError: verified.authError,
        permissionError: verified.permissionError,
        rateLimited: verified.rateLimited,
        error: verified.exists
          ? `Zoom DELETE returned 404 for meeting ${cleanId}, but GET verification indicates the meeting still exists.`
          : verified.error || `Unable to verify 404 deletion for Zoom meeting ${cleanId}.`
      };
    }

    const isTransient = res.status === 429 || res.status >= 500 || res.status === 0;
    if (isTransient && attempt < maxRetries) {
      attempt++;
      const retrySecMs = res.retryAfterSeconds ? Math.min(4000, res.retryAfterSeconds * 1000) : 0;
      await sleepMs(Math.max(retrySecMs, baseDelayMs * attempt));
      continue;
    }

    return {
      ok: false,
      status: res.status || 502,
      meetingId: cleanId,
      deleted: false,
      rateLimited: res.status === 429 || res.code === 'RATE_LIMITED',
      error: res.error || `Failed to delete Zoom meeting ${cleanId} (HTTP ${res.status || 502}).`
    };
  }
}
