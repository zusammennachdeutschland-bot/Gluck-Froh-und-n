import {
  GrainCapabilityReport,
  GrainCapabilityState,
  GrainDiscoveredRecording,
  GrainEducationalDraft,
  GrainGrammarSuggestion,
  GrainGroupLearningCorrectionEntry,
  GrainGroupLearningRecord,
  GrainHomeworkSuggestion,
  GrainLessonMatchCandidate,
  GrainLessonMetadata,
  GrainMatchEvidence,
  GrainMatchStatus,
  GrainShareAccessClassification,
  GrainStudentFollowUpSuggestion,
  GrainVocabularySuggestion,
  GrainZoomLinkVerificationStatus,
  Group,
  Lesson,
  Student
} from '../types';
import { LernstudioSet, LernstudioItem, GrammarExercise } from '../types/lernstudio';
import { normalizeLernstudioSet } from '../shared/grammarEngine';
import { auth } from '../shared/firebaseCloudSync';
import { isAndroidNativePlatform } from '../shared/googleCredentialAuthPlugin';
import {
  __getGrainNativeTestAdapter,
  GrainBridgeOperation,
  GrainBridgeOperationResult,
  invokeAndroidGrainDisconnect,
  invokeAndroidGrainGetStatus,
  invokeAndroidGrainOperation,
  invokeAndroidGrainSaveToken
} from '../shared/grainSecureBridgePlugin';

export type GrainRuntimeType = 'electron' | 'android' | 'web' | 'unsupported';

export interface GrainDiscoveryDiagnosticStepResult {
  testId: 'Test A' | 'Test B' | 'Test C' | 'Test D';
  description: string;
  requestBody: string;
  httpStatus: number;
  errorCode: string | null;
  sanitizedMessage: string;
  hasRecordingsArray: boolean;
  recordingsCount: number;
  hasCursor: boolean;
  durationMs: number;
  skipped?: boolean;
}

export interface GrainIntegrationMetaState {
  enabled: boolean;
  connected: boolean;
  runtime: GrainRuntimeType;
  secureStorageAvailable: boolean;
  hasToken: boolean;
  maskedToken: string | null;
  tokenScope: string | null;
  grainUserId: string | null;
  tokenName: string | null;
  lastSuccessfulSyncAt: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  lastProbeRecordingsCount?: number | null;
  lastDiagnostics?: GrainDiscoveryDiagnosticStepResult[];
  capabilities: GrainCapabilityReport;
}

const GRAIN_LOCAL_META_KEY = 'glueck_grain_integration_meta_v1';
const GRAIN_LOCAL_DISCOVERED_KEY = 'glueck_grain_discovered_recordings_v1';
const GRAIN_GROUP_LEARNING_STORAGE_KEY = 'glueck_grain_group_learning_records_v1';
const GRAIN_REMOVED_LIBRARY_IDS_KEY = 'glueck_grain_removed_library_ids_v1';
const TRANSCRIPT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes max retention
const TRANSCRIPT_CACHE_MAX_ENTRIES = 5;

export function createDefaultCapabilityReport(): GrainCapabilityReport {
  return {
    tokenAuthentication: 'unknown',
    personalApiScope: 'unknown',
    recordingDiscovery: 'unknown',
    recordingUrls: 'unknown',
    zoomCalendarMetadata: 'unknown',
    participants: 'unknown',
    aiSummaries: 'unknown',
    transcriptAccess: 'unknown',
    pagination: 'unknown'
  };
}

// Ephemeral in-memory transcript cache (Rule 3: NEVER persisted to localStorage, IndexedDB, P2P, Firebase, or Backups)
interface EphemeralTranscriptEntry {
  recordingId: string;
  fetchedAtMs: number;
  expiresAtMs: number;
  utterances: Array<{ speaker: string; text: string; startMs?: number; endMs?: number }>;
  plainText: string;
}

const ephemeralTranscriptCache = new Map<string, EphemeralTranscriptEntry>();
let inMemoryGroupLearningRecordsFallback: GrainGroupLearningRecord[] = [];
let inMemoryRemovedLibraryIdsFallback = new Set<string>();

export function clearEphemeralTranscriptCache(): void {
  ephemeralTranscriptCache.clear();
}

export function getEphemeralTranscriptCacheSizeForTesting(): number {
  const now = Date.now();
  for (const [key, entry] of ephemeralTranscriptCache.entries()) {
    if (now >= entry.expiresAtMs) {
      ephemeralTranscriptCache.delete(key);
    }
  }
  return ephemeralTranscriptCache.size;
}

// Test adapter for simulating Electron / Web / Android runtimes in Node unit tests
export interface GrainServiceTestAdapter {
  runtime?: GrainRuntimeType;
  secureStorageAvailable?: boolean;
  getStatus?: () => Promise<{
    supported: boolean;
    secureStorageAvailable: boolean;
    runtime?: string;
    hasToken: boolean;
    maskedToken?: string | null;
  }>;
  saveToken?: (token: string) => Promise<{
    saved: boolean;
    hasToken: boolean;
    maskedToken: string;
    secureStorageAvailable: boolean;
  }>;
  disconnect?: () => Promise<{ disconnected: boolean; hasToken: boolean }>;
  executeOperation?: (options: {
    operation: GrainBridgeOperation;
    recordingId?: string;
    payload?: any;
    payloadJson?: string;
  }) => Promise<GrainBridgeOperationResult>;
}

let grainServiceTestAdapter: GrainServiceTestAdapter | null = null;

export function __setGrainServiceTestAdapter(adapter: GrainServiceTestAdapter | null): void {
  grainServiceTestAdapter = adapter;
}

// Local web session token cache (in-memory only, for localhost Express proxy auth when Firebase Auth is not signed in)
let cachedWebLoopbackSessionToken: string | null = null;

export function detectGrainRuntime(): GrainRuntimeType {
  if (grainServiceTestAdapter?.runtime) {
    return grainServiceTestAdapter.runtime;
  }
  if (__getGrainNativeTestAdapter()?.isAndroidNative?.()) {
    return 'android';
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.electronBridge && win.electronBridge.isElectron && win.electronBridge.grain) {
      return 'electron';
    }
    if (isAndroidNativePlatform()) {
      return 'android';
    }
    const proto = window.location?.protocol || '';
    if (proto === 'http:' || proto === 'https:') {
      return 'web';
    }
  }
  return 'unsupported';
}

/**
 * Strips any potential token or secret from error strings or log messages (Section 5 & 16).
 */
export function redactGrainSecrets(input: unknown): string {
  const raw = typeof input === 'string' ? input : String((input as any)?.message || input || '');
  return raw
    .replace(/grain_pat_[a-zA-Z0-9_-]+/gi, 'grain_pat_[REDACTED]')
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]');
}

/**
 * Loads non-sensitive UI metadata (enabled flag, last sync timestamp, capability statuses).
 * Strictly validates that no token or transcript is present.
 */
export function loadGrainIntegrationMeta(): GrainIntegrationMetaState {
  const runtime = detectGrainRuntime();
  const base: GrainIntegrationMetaState = {
    enabled: true,
    connected: false,
    runtime,
    secureStorageAvailable: runtime !== 'unsupported',
    hasToken: false,
    maskedToken: null,
    tokenScope: null,
    grainUserId: null,
    tokenName: null,
    lastSuccessfulSyncAt: null,
    lastError: null,
    lastErrorCode: null,
    lastProbeRecordingsCount: null,
    lastDiagnostics: [],
    capabilities: createDefaultCapabilityReport()
  };

  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return base;
  }

  try {
    const raw = localStorage.getItem(GRAIN_LOCAL_META_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    return {
      ...base,
      enabled: parsed.enabled !== false,
      connected: Boolean(parsed.connected),
      hasToken: Boolean(parsed.hasToken),
      maskedToken: typeof parsed.maskedToken === 'string' ? redactGrainSecrets(parsed.maskedToken) : null,
      tokenScope: typeof parsed.tokenScope === 'string' ? parsed.tokenScope : null,
      grainUserId: typeof parsed.grainUserId === 'string' ? parsed.grainUserId : null,
      tokenName: typeof parsed.tokenName === 'string' ? parsed.tokenName : null,
      lastSuccessfulSyncAt: typeof parsed.lastSuccessfulSyncAt === 'string' ? parsed.lastSuccessfulSyncAt : null,
      lastError: typeof parsed.lastError === 'string' ? redactGrainSecrets(parsed.lastError) : null,
      lastErrorCode: typeof parsed.lastErrorCode === 'string' ? parsed.lastErrorCode : null,
      lastProbeRecordingsCount: typeof parsed.lastProbeRecordingsCount === 'number' ? parsed.lastProbeRecordingsCount : null,
      lastDiagnostics: Array.isArray(parsed.lastDiagnostics) ? parsed.lastDiagnostics : [],
      capabilities: {
        ...createDefaultCapabilityReport(),
        ...(parsed.capabilities && typeof parsed.capabilities === 'object' ? parsed.capabilities : {})
      }
    };
  } catch {
    return base;
  }
}

export function saveGrainIntegrationMeta(next: Partial<GrainIntegrationMetaState>): GrainIntegrationMetaState {
  const current = loadGrainIntegrationMeta();
  const merged: GrainIntegrationMetaState = {
    ...current,
    ...next,
    lastError: next.lastError !== undefined ? (next.lastError ? redactGrainSecrets(next.lastError) : null) : current.lastError,
    capabilities: next.capabilities ? { ...current.capabilities, ...next.capabilities } : current.capabilities
  };

  // Never allow a raw unmasked token in maskedToken
  if (merged.maskedToken && !merged.maskedToken.includes('•')) {
    merged.maskedToken = 'grain_pat_••••••••';
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const safeToStore = {
        enabled: merged.enabled,
        connected: merged.connected,
        hasToken: merged.hasToken,
        maskedToken: merged.maskedToken,
        tokenScope: merged.tokenScope,
        grainUserId: merged.grainUserId,
        tokenName: merged.tokenName,
        lastSuccessfulSyncAt: merged.lastSuccessfulSyncAt,
        lastError: merged.lastError,
        lastErrorCode: merged.lastErrorCode,
        lastProbeRecordingsCount: merged.lastProbeRecordingsCount ?? null,
        lastDiagnostics: merged.lastDiagnostics ?? [],
        capabilities: merged.capabilities
      };
      localStorage.setItem(GRAIN_LOCAL_META_KEY, JSON.stringify(safeToStore));
    } catch {
      // Ignore storage quota errors
    }
  }
  return merged;
}

export function loadRemovedGrainLibraryIds(): string[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return Array.from(inMemoryRemovedLibraryIdsFallback);
  }
  try {
    const raw = localStorage.getItem(GRAIN_REMOVED_LIBRARY_IDS_KEY);
    if (!raw) return Array.from(inMemoryRemovedLibraryIdsFallback);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return Array.from(inMemoryRemovedLibraryIdsFallback);
  }
}

export function removeGrainRecordingFromLocalLibrary(recordingId: string): GrainDiscoveredRecording[] {
  const cleanId = String(recordingId || '').trim();
  if (!cleanId) return loadDiscoveredGrainRecordings();
  inMemoryRemovedLibraryIdsFallback.add(cleanId);
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const currentRemoved = new Set(loadRemovedGrainLibraryIds());
      currentRemoved.add(cleanId);
      localStorage.setItem(GRAIN_REMOVED_LIBRARY_IDS_KEY, JSON.stringify(Array.from(currentRemoved)));
    } catch {
      // Ignore storage errors
    }
  }
  const existing = loadDiscoveredGrainRecordings({ includeRemoved: true });
  const updated = existing.map((r) => (r.id === cleanId ? { ...r, removedFromLibrary: true } : r));
  saveDiscoveredGrainRecordings(updated);
  return updated.filter((r) => !r.removedFromLibrary);
}

export function restoreRemovedGrainLibraryEntries(): GrainDiscoveredRecording[] {
  inMemoryRemovedLibraryIdsFallback.clear();
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(GRAIN_REMOVED_LIBRARY_IDS_KEY);
    } catch {
      // Ignore
    }
  }
  const existing = loadDiscoveredGrainRecordings({ includeRemoved: true }).map((r) => ({
    ...r,
    removedFromLibrary: false
  }));
  saveDiscoveredGrainRecordings(existing);
  return existing;
}

export function loadDiscoveredGrainRecordings(options?: { includeRemoved?: boolean }): GrainDiscoveredRecording[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(GRAIN_LOCAL_DISCOVERED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const removedSet = new Set(loadRemovedGrainLibraryIds());
    const valid = parsed
      .filter((r) => r && typeof r.id === 'string' && typeof r.recordingUrl === 'string')
      .map((r) => ({
        ...r,
        removedFromLibrary: Boolean(r.removedFromLibrary || removedSet.has(r.id))
      }));
    return options?.includeRemoved ? valid : valid.filter((r) => !r.removedFromLibrary);
  } catch {
    return [];
  }
}

export function saveDiscoveredGrainRecordings(recordings: GrainDiscoveredRecording[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    // Keep at most 200 recent discovered recording metadata entries locally
    const trimmed = recordings.slice(0, 200).map((r) => ({
      ...r,
      aiSummaryExcerpt: r.aiSummaryExcerpt ? r.aiSummaryExcerpt.slice(0, 450) : undefined
    }));
    localStorage.setItem(GRAIN_LOCAL_DISCOVERED_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

async function buildWebProxyAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  try {
    const currentUser = auth?.currentUser;
    if (currentUser && typeof currentUser.getIdToken === 'function') {
      const idToken = await currentUser.getIdToken();
      if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
        headers['X-Owner-Uid'] = currentUser.uid;
        return headers;
      }
    }
  } catch {
    // Fallback to local loopback session token if on localhost
  }

  if (cachedWebLoopbackSessionToken) {
    headers['X-Grain-Session-Token'] = cachedWebLoopbackSessionToken;
    return headers;
  }

  if (typeof window !== 'undefined' && typeof fetch === 'function') {
    try {
      const res = await fetch('/api/grain/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: 'web_teacher' })
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.sessionToken === 'string' && data.sessionToken) {
          cachedWebLoopbackSessionToken = data.sessionToken;
          headers['X-Grain-Session-Token'] = data.sessionToken;
        }
      }
    } catch {
      // Ignore session acquisition error
    }
  }

  return headers;
}

export async function refreshGrainRuntimeStatus(): Promise<GrainIntegrationMetaState> {
  const runtime = detectGrainRuntime();
  if (runtime === 'unsupported') {
    return saveGrainIntegrationMeta({
      runtime: 'unsupported',
      secureStorageAvailable: false,
      connected: false,
      hasToken: false,
      maskedToken: null
    });
  }

  try {
    if (grainServiceTestAdapter?.getStatus) {
      const st = await grainServiceTestAdapter.getStatus();
      return saveGrainIntegrationMeta({
        runtime,
        secureStorageAvailable: st.secureStorageAvailable,
        hasToken: st.hasToken,
        maskedToken: st.maskedToken || null,
        connected: st.hasToken && loadGrainIntegrationMeta().connected
      });
    }

    if (runtime === 'electron') {
      const st = await (window as any).electronBridge.grain.getStatus();
      return saveGrainIntegrationMeta({
        runtime: 'electron',
        secureStorageAvailable: Boolean(st?.secureStorageAvailable),
        hasToken: Boolean(st?.hasToken),
        maskedToken: st?.maskedToken || null,
        connected: Boolean(st?.hasToken) && loadGrainIntegrationMeta().connected
      });
    }

    if (runtime === 'android') {
      const st = await invokeAndroidGrainGetStatus();
      return saveGrainIntegrationMeta({
        runtime: 'android',
        secureStorageAvailable: Boolean(st?.secureStorageAvailable),
        hasToken: Boolean(st?.hasToken),
        maskedToken: st?.maskedToken || null,
        connected: Boolean(st?.hasToken) && loadGrainIntegrationMeta().connected
      });
    }

    if (runtime === 'web') {
      const headers = await buildWebProxyAuthHeaders();
      const res = await fetch('/api/grain/status', { method: 'GET', headers });
      if (!res.ok) {
        return saveGrainIntegrationMeta({
          runtime: 'web',
          secureStorageAvailable: true,
          hasToken: false,
          connected: false
        });
      }
      const data = await res.json();
      return saveGrainIntegrationMeta({
        runtime: 'web',
        secureStorageAvailable: Boolean(data?.secureStorageAvailable),
        hasToken: Boolean(data?.hasToken),
        maskedToken: data?.maskedToken || null,
        connected: Boolean(data?.hasToken) && loadGrainIntegrationMeta().connected
      });
    }
  } catch (err) {
    return saveGrainIntegrationMeta({
      runtime,
      lastError: redactGrainSecrets(err),
      lastErrorCode: 'STATUS_CHECK_FAILED'
    });
  }

  return loadGrainIntegrationMeta();
}

export async function saveGrainPersonalToken(rawToken: string): Promise<{
  success: boolean;
  state: GrainIntegrationMetaState;
  error?: string;
  errorCode?: string;
}> {
  const cleanToken = String(rawToken || '').trim();
  if (!cleanToken || cleanToken.length < 10 || /\s/.test(cleanToken)) {
    const state = saveGrainIntegrationMeta({
      lastError: 'Invalid Grain Personal Access Token format.',
      lastErrorCode: 'INVALID_TOKEN_FORMAT'
    });
    return {
      success: false,
      state,
      error: 'Invalid Grain Personal Access Token format.',
      errorCode: 'INVALID_TOKEN_FORMAT'
    };
  }

  const runtime = detectGrainRuntime();
  if (runtime === 'unsupported') {
    const state = saveGrainIntegrationMeta({
      runtime: 'unsupported',
      secureStorageAvailable: false,
      hasToken: false,
      connected: false,
      lastError: 'Current runtime does not support secure credential storage.',
      lastErrorCode: 'UNSUPPORTED_RUNTIME'
    });
    return {
      success: false,
      state,
      error: 'Current runtime does not support secure credential storage.',
      errorCode: 'UNSUPPORTED_RUNTIME'
    };
  }

  try {
    if (grainServiceTestAdapter?.saveToken) {
      const saved = await grainServiceTestAdapter.saveToken(cleanToken);
      const state = saveGrainIntegrationMeta({
        runtime,
        secureStorageAvailable: saved.secureStorageAvailable,
        hasToken: saved.hasToken,
        maskedToken: saved.maskedToken,
        lastError: null,
        lastErrorCode: null
      });
      return { success: true, state };
    }

    if (runtime === 'electron') {
      const saved = await (window as any).electronBridge.grain.saveToken(cleanToken);
      const state = saveGrainIntegrationMeta({
        runtime: 'electron',
        secureStorageAvailable: Boolean(saved?.secureStorageAvailable),
        hasToken: Boolean(saved?.hasToken),
        maskedToken: saved?.maskedToken || 'grain_pat_••••••••',
        lastError: null,
        lastErrorCode: null
      });
      return { success: true, state };
    }

    if (runtime === 'android') {
      const saved = await invokeAndroidGrainSaveToken(cleanToken);
      const state = saveGrainIntegrationMeta({
        runtime: 'android',
        secureStorageAvailable: Boolean(saved?.secureStorageAvailable),
        hasToken: Boolean(saved?.hasToken),
        maskedToken: saved?.maskedToken || 'grain_pat_••••••••',
        lastError: null,
        lastErrorCode: null
      });
      return { success: true, state };
    }

    if (runtime === 'web') {
      const headers = await buildWebProxyAuthHeaders();
      const res = await fetch('/api/grain/connect', {
        method: 'POST',
        headers,
        body: JSON.stringify({ token: cleanToken })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.saved) {
        const errMsg = redactGrainSecrets(data?.error || 'Failed to store token on server proxy.');
        const errCode = String(data?.code || 'SAVE_FAILED');
        const state = saveGrainIntegrationMeta({
          lastError: errMsg,
          lastErrorCode: errCode
        });
        return { success: false, state, error: errMsg, errorCode: errCode };
      }
      const state = saveGrainIntegrationMeta({
        runtime: 'web',
        secureStorageAvailable: true,
        hasToken: true,
        maskedToken: data.maskedToken || 'grain_pat_••••••••',
        lastError: null,
        lastErrorCode: null
      });
      return { success: true, state };
    }
  } catch (err: any) {
    const errMsg = redactGrainSecrets(err);
    const errCode = String(err?.code || 'SECURE_STORAGE_FAILED');
    const state = saveGrainIntegrationMeta({
      lastError: errMsg,
      lastErrorCode: errCode
    });
    return { success: false, state, error: errMsg, errorCode: errCode };
  }

  return {
    success: false,
    state: loadGrainIntegrationMeta(),
    error: 'Unsupported runtime',
    errorCode: 'UNSUPPORTED_RUNTIME'
  };
}

export async function disconnectGrainAccount(): Promise<GrainIntegrationMetaState> {
  const runtime = detectGrainRuntime();
  clearEphemeralTranscriptCache();
  cachedWebLoopbackSessionToken = null;

  try {
    if (grainServiceTestAdapter?.disconnect) {
      await grainServiceTestAdapter.disconnect();
    } else if (runtime === 'electron' && typeof window !== 'undefined' && (window as any).electronBridge?.grain) {
      await (window as any).electronBridge.grain.disconnect();
    } else if (runtime === 'android') {
      await invokeAndroidGrainDisconnect();
    } else if (runtime === 'web' && typeof fetch === 'function') {
      const headers = await buildWebProxyAuthHeaders();
      await fetch('/api/grain/disconnect', { method: 'POST', headers });
    }
  } catch {
    // Proceed with local cleanup even if remote disconnect fails
  }

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(GRAIN_LOCAL_DISCOVERED_KEY);
      localStorage.removeItem(GRAIN_LOCAL_META_KEY);
    } catch {
      // Ignore storage error
    }
  }

  return saveGrainIntegrationMeta({
    enabled: true,
    connected: false,
    hasToken: false,
    maskedToken: null,
    tokenScope: null,
    grainUserId: null,
    tokenName: null,
    lastSuccessfulSyncAt: null,
    lastError: null,
    lastErrorCode: null,
    capabilities: createDefaultCapabilityReport()
  });
}

const GRAIN_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRAIN_FORBIDDEN_TOP_LEVEL_FILTER_KEYS = [
  'after_datetime',
  'before_datetime',
  'title_search',
  'participant_scope',
  'attendance',
  'team',
  'meeting_type'
] as const;

const GRAIN_ALLOWED_LIST_TOP_KEYS = new Set(['cursor', 'filter', 'include']);
const GRAIN_ALLOWED_DETAILS_TOP_KEYS = new Set(['include']);
const GRAIN_ALLOWED_FILTER_KEYS = new Set([
  'before_datetime',
  'after_datetime',
  'participant_scope',
  'title_search',
  'team',
  'meeting_type',
  'attendance'
]);

const GRAIN_DOCUMENTED_BOOLEAN_INCLUDE_KEYS = [
  'highlights',
  'participants',
  'ai_action_items',
  'ai_summary',
  'private_notes',
  'calendar_event',
  'hubspot',
  'screenshares',
  'sensitivity_matches'
] as const;

const GRAIN_ALLOWED_INCLUDE_KEYS = new Set<string>([
  ...GRAIN_DOCUMENTED_BOOLEAN_INCLUDE_KEYS,
  'ai_template_sections'
]);

export function formatGrainIso8601Timestamp(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function extractGrainAiSummaryText(rawAiSummary: any): string {
  if (!rawAiSummary) return '';
  if (typeof rawAiSummary === 'string') return rawAiSummary.trim();
  if (typeof rawAiSummary === 'object') {
    if (typeof rawAiSummary.text === 'string' && rawAiSummary.text.trim()) {
      return rawAiSummary.text.trim();
    }
    if (typeof rawAiSummary.summary === 'string' && rawAiSummary.summary.trim()) {
      return rawAiSummary.summary.trim();
    }
    if (typeof rawAiSummary.markdown === 'string' && rawAiSummary.markdown.trim()) {
      return rawAiSummary.markdown.trim();
    }
  }
  return '';
}

/**
 * Canonical request body builder shared across Web Proxy, Electron, and Android runtimes.
 * Enforces Grain Public API v2 (`2026-10-01`) schema (Part 6 — FIX-5 & Part 7):
 * - Only `cursor`, `filter`, and `include` at top level for `list_recordings`.
 * - Rejects top-level `after_datetime`, `before_datetime`, `title_search`, and any unknown keys.
 * - Rejects unknown filter keys and unknown include keys (e.g. `owners`, `tags`).
 * - Formats `ai_template_sections` as a documented object `{ format: 'json' | 'markdown' | 'text' }`, never a boolean.
 */
export function buildCanonicalGrainRequestBody(
  operation: GrainBridgeOperation,
  rawPayload?: any
): {
  valid: boolean;
  errorCode?: string;
  errorMessage?: string;
  bodyObject?: Record<string, any>;
  bodyJson?: string;
} {
  if (operation === 'token_info' || operation === 'recording_transcript') {
    return { valid: true };
  }

  const p =
    rawPayload && typeof rawPayload === 'object' && !Array.isArray(rawPayload)
      ? (rawPayload as Record<string, any>)
      : {};

  const sanitizeIncludeObj = (rawInc: any): Record<string, any> | undefined => {
    if (!rawInc || typeof rawInc !== 'object' || Array.isArray(rawInc)) {
      return undefined;
    }
    const out: Record<string, any> = {};
    for (const key of GRAIN_DOCUMENTED_BOOLEAN_INCLUDE_KEYS) {
      if (rawInc[key] === true) {
        out[key] = true;
      }
    }
    if (rawInc.ai_template_sections && typeof rawInc.ai_template_sections === 'object' && !Array.isArray(rawInc.ai_template_sections)) {
      const ats = rawInc.ai_template_sections;
      const cleanAts: Record<string, any> = {
        format: ats.format === 'json' || ats.format === 'markdown' || ats.format === 'text' ? ats.format : 'json'
      };
      if (Array.isArray(ats.allowed_sections)) {
        const secs = ats.allowed_sections
          .filter((s: unknown): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s: string) => s.trim());
        if (secs.length > 0) {
          cleanAts.allowed_sections = secs;
        }
      }
      out.ai_template_sections = cleanAts;
    } else if (rawInc.ai_template_sections === true) {
      out.ai_template_sections = { format: 'json' };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  if (operation === 'list_recordings') {
    for (const forbiddenTopKey of GRAIN_FORBIDDEN_TOP_LEVEL_FILTER_KEYS) {
      if (p[forbiddenTopKey] !== undefined) {
        return {
          valid: false,
          errorCode: 'INVALID_TOP_LEVEL_FILTER',
          errorMessage: `Field "${forbiddenTopKey}" must be nested inside "filter", not sent as a top-level field.`
        };
      }
    }

    for (const key of Object.keys(p)) {
      if (!GRAIN_ALLOWED_LIST_TOP_KEYS.has(key)) {
        return {
          valid: false,
          errorCode: 'UNKNOWN_FIELD_FORBIDDEN',
          errorMessage: `Unknown top-level field "${key}" is not allowed in list_recordings.`
        };
      }
    }

    if (p.filter !== undefined) {
      if (!p.filter || typeof p.filter !== 'object' || Array.isArray(p.filter)) {
        return {
          valid: false,
          errorCode: 'INVALID_FILTER_OBJECT',
          errorMessage: '"filter" must be a plain JSON object.'
        };
      }
      for (const fKey of Object.keys(p.filter)) {
        if (!GRAIN_ALLOWED_FILTER_KEYS.has(fKey)) {
          return {
            valid: false,
            errorCode: 'UNKNOWN_FILTER_FIELD',
            errorMessage: `Unknown filter field "${fKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }

    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return {
          valid: false,
          errorCode: 'INVALID_INCLUDE_OBJECT',
          errorMessage: '"include" must be a plain JSON object.'
        };
      }
      for (const incKey of Object.keys(p.include)) {
        if (!GRAIN_ALLOWED_INCLUDE_KEYS.has(incKey)) {
          return {
            valid: false,
            errorCode: 'UNKNOWN_INCLUDE_FIELD',
            errorMessage: `Unknown include field "${incKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }

    const bodyObject: Record<string, any> = {};
    if (typeof p.cursor === 'string' && p.cursor.trim()) {
      bodyObject.cursor = p.cursor.trim();
    }

    if (p.filter && typeof p.filter === 'object' && !Array.isArray(p.filter)) {
      const f: Record<string, any> = {};
      const beforeDt = formatGrainIso8601Timestamp(p.filter.before_datetime);
      if (beforeDt) f.before_datetime = beforeDt;
      const afterDt = formatGrainIso8601Timestamp(p.filter.after_datetime);
      if (afterDt) f.after_datetime = afterDt;
      if (p.filter.attendance === 'hosted' || p.filter.attendance === 'attended') {
        f.attendance = p.filter.attendance;
      }
      if (p.filter.participant_scope === 'internal' || p.filter.participant_scope === 'external') {
        f.participant_scope = p.filter.participant_scope;
      }
      if (typeof p.filter.title_search === 'string' && p.filter.title_search.trim()) {
        f.title_search = p.filter.title_search.trim();
      }
      if (typeof p.filter.team === 'string' && GRAIN_UUID_REGEX.test(p.filter.team.trim())) {
        f.team = p.filter.team.trim();
      }
      if (typeof p.filter.meeting_type === 'string' && GRAIN_UUID_REGEX.test(p.filter.meeting_type.trim())) {
        f.meeting_type = p.filter.meeting_type.trim();
      }
      if (Object.keys(f).length > 0) {
        bodyObject.filter = f;
      }
    }

    const cleanInclude = sanitizeIncludeObj(p.include);
    if (cleanInclude) {
      bodyObject.include = cleanInclude;
    }

    return {
      valid: true,
      bodyObject,
      bodyJson: JSON.stringify(bodyObject)
    };
  }

  if (operation === 'recording_details') {
    for (const key of Object.keys(p)) {
      if (!GRAIN_ALLOWED_DETAILS_TOP_KEYS.has(key)) {
        return {
          valid: false,
          errorCode: 'UNKNOWN_FIELD_FORBIDDEN',
          errorMessage: `Unknown top-level field "${key}" is not allowed in recording_details.`
        };
      }
    }
    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return {
          valid: false,
          errorCode: 'INVALID_INCLUDE_OBJECT',
          errorMessage: '"include" must be a plain JSON object.'
        };
      }
      for (const incKey of Object.keys(p.include)) {
        if (!GRAIN_ALLOWED_INCLUDE_KEYS.has(incKey)) {
          return {
            valid: false,
            errorCode: 'UNKNOWN_INCLUDE_FIELD',
            errorMessage: `Unknown include field "${incKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }
    const bodyObject: Record<string, any> = {};
    const cleanInclude = sanitizeIncludeObj(p.include);
    if (cleanInclude) {
      bodyObject.include = cleanInclude;
    }
    return {
      valid: true,
      bodyObject,
      bodyJson: JSON.stringify(bodyObject)
    };
  }

  return { valid: true, bodyObject: {}, bodyJson: '{}' };
}

/**
 * Extracts a sanitized diagnostic message from a Grain API error payload without exposing
 * tokens, recording titles, participant names, or emails.
 */
function extractSanitizedGrainErrorDetail(parsedData: any): string {
  if (!parsedData || typeof parsedData !== 'object') return '';
  const parts: string[] = [];
  if (typeof parsedData.error === 'string' && parsedData.error.trim()) {
    parts.push(parsedData.error.trim());
  }
  const detailCandidate =
    parsedData.message ||
    parsedData.error_description ||
    parsedData.detail ||
    (typeof parsedData.details === 'string' ? parsedData.details : undefined);
  if (typeof detailCandidate === 'string' && detailCandidate.trim() && detailCandidate.trim() !== parsedData.error) {
    parts.push(detailCandidate.trim());
  } else if (Array.isArray(parsedData.errors) && parsedData.errors.length > 0) {
    const firstErr = parsedData.errors[0];
    const firstStr =
      typeof firstErr === 'string'
        ? firstErr
        : typeof firstErr?.message === 'string'
        ? `${firstErr.field ? `${firstErr.field}: ` : ''}${firstErr.message}`
        : '';
    if (firstStr.trim()) {
      parts.push(firstStr.trim());
    }
  }
  return redactGrainSecrets(parts.join(' — ')).slice(0, 260);
}

/**
 * Classifies an HTTP status and parsed Grain response according to Section 5 rules:
 * - HTTP 200 with valid response (including 0 recordings): 'available_tested'
 * - HTTP 400 / 'bad_request': 'failed' (NEVER 'restricted')
 * - HTTP 401: authentication failure ('failed')
 * - HTTP 403: 'restricted' only when response confirms permission/scope restriction; otherwise 'failed'
 * - HTTP 402: 'restricted' only when supported by the actual response; otherwise 'failed'
 * - HTTP 429: rate limited ('failed')
 * - Network errors: connection failure ('failed')
 */
export function classifyGrainOperationOutcome(options: {
  operation: GrainBridgeOperation;
  httpStatus: number;
  parsedData: any;
  retryAfter?: string;
}): {
  ok: boolean;
  capabilityState: GrainCapabilityState;
  errorCode: string | null;
  errorMessage: string | null;
} {
  const { operation, httpStatus, parsedData, retryAfter } = options;

  if (httpStatus >= 200 && httpStatus < 300) {
    if (operation === 'list_recordings') {
      const hasValidRecordingsArray = Boolean(
        parsedData &&
          typeof parsedData === 'object' &&
          (Array.isArray(parsedData.recordings) || Array.isArray(parsedData.data))
      );
      if (!hasValidRecordingsArray) {
        return {
          ok: false,
          capabilityState: 'failed',
          errorCode: 'INVALID_RESPONSE_SCHEMA',
          errorMessage: 'Grain API returned HTTP 200 without a recordings array.'
        };
      }
    }
    return {
      ok: true,
      capabilityState: 'available_tested',
      errorCode: null,
      errorMessage: null
    };
  }

  const sanitizedDetail = extractSanitizedGrainErrorDetail(parsedData);
  const rawErrorField = typeof parsedData?.error === 'string' ? parsedData.error.trim().toLowerCase() : '';

  // Rule: Never classify HTTP 400 or "bad_request" as a plan restriction!
  if (httpStatus === 400 || rawErrorField === 'bad_request') {
    return {
      ok: false,
      capabilityState: 'failed',
      errorCode: 'BAD_REQUEST',
      errorMessage: sanitizedDetail
        ? `Grain API rejected the request schema (HTTP ${httpStatus || 400}): ${sanitizedDetail}`
        : `Grain API rejected the request schema (HTTP ${httpStatus || 400}: bad_request).`
    };
  }

  if (httpStatus === 401 || rawErrorField === 'unauthorized' || rawErrorField === 'invalid_token') {
    return {
      ok: false,
      capabilityState: 'failed',
      errorCode: 'INVALID_TOKEN',
      errorMessage: sanitizedDetail
        ? `Authentication failed (HTTP 401): ${sanitizedDetail}`
        : 'Invalid, expired, or revoked Grain Personal Access Token (HTTP 401).'
    };
  }

  if (httpStatus === 402) {
    const confirmsPlanOrPayment =
      rawErrorField.includes('payment') ||
      rawErrorField.includes('plan') ||
      rawErrorField.includes('quota') ||
      rawErrorField.includes('subscription') ||
      rawErrorField.includes('upgrade') ||
      /payment|plan|quota|subscription|upgrade|tier|billing/i.test(sanitizedDetail);
    return {
      ok: false,
      capabilityState: confirmsPlanOrPayment ? 'restricted' : 'failed',
      errorCode: confirmsPlanOrPayment ? 'PLAN_QUOTA_RESTRICTED' : 'UPSTREAM_ERROR',
      errorMessage: confirmsPlanOrPayment
        ? `Restricted by Grain plan or quota (HTTP 402)${sanitizedDetail ? `: ${sanitizedDetail}` : '.'}`
        : `Grain API returned HTTP 402${sanitizedDetail ? `: ${sanitizedDetail}` : '.'}`
    };
  }

  if (httpStatus === 403) {
    const confirmsPermissionRestriction =
      rawErrorField === 'forbidden' ||
      rawErrorField.includes('permission') ||
      rawErrorField.includes('scope') ||
      rawErrorField.includes('access_denied') ||
      rawErrorField.includes('restricted') ||
      rawErrorField.includes('not_allowed') ||
      /forbidden|permission|scope|access|restricted|workspace|plan/i.test(sanitizedDetail);
    const code =
      operation === 'recording_transcript'
        ? confirmsPermissionRestriction
          ? 'TRANSCRIPT_RESTRICTED'
          : 'UPSTREAM_ERROR'
        : confirmsPermissionRestriction
        ? 'ACCESS_RESTRICTED'
        : 'UPSTREAM_ERROR';
    return {
      ok: false,
      capabilityState: confirmsPermissionRestriction ? 'restricted' : 'failed',
      errorCode: code,
      errorMessage: confirmsPermissionRestriction
        ? `Permission restriction confirmed by Grain (HTTP 403)${sanitizedDetail ? `: ${sanitizedDetail}` : '.'}`
        : `Grain API returned HTTP 403${sanitizedDetail ? `: ${sanitizedDetail}` : '.'}`
    };
  }

  if (httpStatus === 404) {
    return {
      ok: false,
      capabilityState: 'failed',
      errorCode: 'RECORDING_INACCESSIBLE',
      errorMessage: sanitizedDetail || 'Recording is no longer accessible or was deleted (HTTP 404).'
    };
  }

  if (httpStatus === 429 || rawErrorField === 'rate_limited' || rawErrorField === 'too_many_requests') {
    return {
      ok: false,
      capabilityState: 'failed',
      errorCode: 'RATE_LIMITED',
      errorMessage: `Grain API rate limit reached (HTTP 429).${retryAfter ? ` Retry after ${retryAfter}s.` : ''}`
    };
  }

  if (httpStatus === 0 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504 || rawErrorField === 'network_error') {
    return {
      ok: false,
      capabilityState: 'failed',
      errorCode: 'NETWORK_ERROR',
      errorMessage: sanitizedDetail || 'Connection failure while contacting Grain API.'
    };
  }

  return {
    ok: false,
    capabilityState: 'failed',
    errorCode: 'UPSTREAM_ERROR',
    errorMessage: sanitizedDetail || `Grain API request failed (HTTP ${httpStatus}).`
  };
}

export async function executeScopedGrainOperation(options: {
  operation: GrainBridgeOperation;
  recordingId?: string;
  payload?: any;
}): Promise<{
  ok: boolean;
  httpStatus: number;
  retryAfter?: string;
  data?: any;
  errorCode?: string;
  errorMessage?: string;
  capabilityState?: GrainCapabilityState;
  requestBodyJson?: string;
}> {
  const runtime = detectGrainRuntime();
  if (runtime === 'unsupported') {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: 'UNSUPPORTED_RUNTIME',
      errorMessage: 'Grain integration is not supported in this runtime.',
      capabilityState: 'unsupported'
    };
  }

  const canonical = buildCanonicalGrainRequestBody(options.operation, options.payload);
  if (!canonical.valid) {
    return {
      ok: false,
      httpStatus: 400,
      errorCode: canonical.errorCode || 'BAD_REQUEST',
      errorMessage: canonical.errorMessage || 'Invalid Grain request body.',
      capabilityState: 'failed'
    };
  }

  const payloadJson = canonical.bodyJson || '{}';
  const payloadObj = canonical.bodyObject || {};

  try {
    let rawResult: GrainBridgeOperationResult;

    if (grainServiceTestAdapter?.executeOperation) {
      rawResult = await grainServiceTestAdapter.executeOperation({
        operation: options.operation,
        recordingId: options.recordingId,
        payload: payloadObj,
        payloadJson
      });
    } else if (runtime === 'electron') {
      rawResult = await (window as any).electronBridge.grain.executeOperation({
        operation: options.operation,
        recordingId: options.recordingId,
        payloadJson
      });
    } else if (runtime === 'android') {
      rawResult = await invokeAndroidGrainOperation({
        operation: options.operation,
        recordingId: options.recordingId,
        payloadJson
      });
    } else {
      const headers = await buildWebProxyAuthHeaders();
      const res = await fetch('/api/grain/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          operation: options.operation,
          recordingId: options.recordingId,
          payload: payloadObj
        })
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const proxyStatus = res.status;
        return {
          ok: false,
          httpStatus: proxyStatus,
          errorCode: String(errBody?.code || (proxyStatus === 400 ? 'BAD_REQUEST' : 'PROXY_ERROR')),
          errorMessage: redactGrainSecrets(errBody?.error || `HTTP ${proxyStatus}`),
          capabilityState: 'failed',
          requestBodyJson: payloadJson
        };
      }
      rawResult = await res.json();
    }

    const status = Number(rawResult?.httpStatus || 0);
    let parsedData: any = null;
    if (typeof rawResult?.bodyText === 'string' && rawResult.bodyText.trim()) {
      try {
        parsedData = JSON.parse(rawResult.bodyText);
      } catch {
        parsedData = { rawText: rawResult.bodyText.slice(0, 500) };
      }
    }

    const classified = classifyGrainOperationOutcome({
      operation: options.operation,
      httpStatus: status,
      parsedData,
      retryAfter: rawResult?.retryAfter
    });

    if (classified.ok) {
      return {
        ok: true,
        httpStatus: status,
        retryAfter: rawResult?.retryAfter,
        data: parsedData,
        capabilityState: classified.capabilityState,
        requestBodyJson: payloadJson
      };
    }

    return {
      ok: false,
      httpStatus: status,
      retryAfter: rawResult?.retryAfter,
      errorCode: classified.errorCode || 'UPSTREAM_ERROR',
      errorMessage: classified.errorMessage || 'Grain API request failed.',
      capabilityState: classified.capabilityState,
      requestBodyJson: payloadJson
    };
  } catch (err: any) {
    return {
      ok: false,
      httpStatus: 0,
      errorCode: String(err?.code || 'NETWORK_ERROR'),
      errorMessage: redactGrainSecrets(err?.message || 'Network error while contacting Grain API.'),
      capabilityState: 'failed',
      requestBodyJson: payloadJson
    };
  }
}

/**
 * Executes the 4-step Recording Discovery diagnostic isolation sequence (Section 3):
 * - Test A: POST recordings with body "{}"
 * - Test B: POST recordings with '{"include":{"participants":true}}'
 * - Test C: POST recordings with a valid documented filter inside "filter"
 * - Test D: Test cursor pagination only if Test A returns a valid cursor
 *
 * Records sanitized status, error code, message, recordings array presence, and cursor presence.
 * Never logs or exposes recording titles, participant names, emails, tokens, or private details.
 */
export async function runGrainRecordingDiscoveryDiagnostics(): Promise<{
  steps: GrainDiscoveryDiagnosticStepResult[];
  testAResponseData: any;
  testBResponseData: any;
}> {
  const steps: GrainDiscoveryDiagnosticStepResult[] = [];

  const runSingleStep = async (
    testId: GrainDiscoveryDiagnosticStepResult['testId'],
    description: string,
    payload: Record<string, any>
  ): Promise<{ step: GrainDiscoveryDiagnosticStepResult; data: any }> => {
    const startMs = Date.now();
    const res = await executeScopedGrainOperation({
      operation: 'list_recordings',
      payload
    });
    const durationMs = Math.max(1, Date.now() - startMs);
    const recordingsArr = Array.isArray(res.data?.recordings)
      ? res.data.recordings
      : Array.isArray(res.data?.data)
      ? res.data.data
      : null;
    const hasRecordingsArray = Array.isArray(recordingsArr);
    const recordingsCount = hasRecordingsArray ? recordingsArr.length : 0;
    const cursorVal = res.data?.cursor ?? res.data?.next_cursor ?? null;
    const hasCursor = typeof cursorVal === 'string' && cursorVal.trim().length > 0;

    const sanitizedMessage = res.ok
      ? `HTTP ${res.httpStatus} OK — recordings array present (${recordingsCount} recording(s)), cursor: ${hasCursor ? 'present' : 'null'}`
      : redactGrainSecrets(res.errorMessage || `HTTP ${res.httpStatus} failed`);

    return {
      step: {
        testId,
        description,
        requestBody: res.requestBodyJson || JSON.stringify(payload),
        httpStatus: res.httpStatus,
        errorCode: res.ok ? null : res.errorCode || 'FAILED',
        sanitizedMessage,
        hasRecordingsArray,
        recordingsCount,
        hasCursor,
        durationMs
      },
      data: res.data
    };
  };

  // Test A: Minimal "{}" request
  const resA = await runSingleStep('Test A', 'Minimal POST /_/public-api/v2/recordings with "{}"', {});
  steps.push(resA.step);

  // Test B: Documented include '{"include":{"participants":true}}'
  const resB = await runSingleStep(
    'Test B',
    'POST /_/public-api/v2/recordings with {"include":{"participants":true}}',
    { include: { participants: true } }
  );
  steps.push(resB.step);

  // Test C: Valid documented filter inside "filter"
  const resC = await runSingleStep(
    'Test C',
    'POST /_/public-api/v2/recordings with documented filter {"filter":{"title_search":"a"}}',
    { filter: { title_search: 'a' } }
  );
  steps.push(resC.step);

  // Test D: Cursor pagination ONLY if Test A returned a valid cursor
  const firstCursor =
    typeof resA.data?.cursor === 'string' && resA.data.cursor.trim()
      ? resA.data.cursor.trim()
      : typeof resA.data?.next_cursor === 'string' && resA.data.next_cursor.trim()
      ? resA.data.next_cursor.trim()
      : null;

  if (firstCursor) {
    const resD = await runSingleStep(
      'Test D',
      'POST /_/public-api/v2/recordings cursor pagination test',
      { cursor: firstCursor }
    );
    steps.push(resD.step);
  } else {
    steps.push({
      testId: 'Test D',
      description: 'POST /_/public-api/v2/recordings cursor pagination test',
      requestBody: '{"cursor":"<none>"}',
      httpStatus: 200,
      errorCode: null,
      sanitizedMessage: 'Skipped: Test A did not return a next-page cursor (all recordings fit on page 1).',
      hasRecordingsArray: false,
      recordingsCount: 0,
      hasCursor: false,
      durationMs: 0,
      skipped: true
    });
  }

  return {
    steps,
    testAResponseData: resA.data,
    testBResponseData: resB.data
  };
}

/**
 * Probes actual account capabilities via `GET /_/public-api/v2/token-info`,
 * the 4-step Recording Discovery diagnostic sequence (`POST /_/public-api/v2/recordings`),
 * and (only if at least one recording exists) `POST /_/public-api/v2/recordings/:id` and
 * `GET /_/public-api/v2/recordings/:id/transcript`.
 * Never marks an untested capability as `available_tested`.
 */
export async function testAndProbeGrainConnection(): Promise<{
  connected: boolean;
  state: GrainIntegrationMetaState;
  error?: string;
}> {
  const capabilities = createDefaultCapabilityReport();
  capabilities.probedAt = new Date().toISOString();

  // 1. Validate Token Info
  const tokenRes = await executeScopedGrainOperation({ operation: 'token_info' });
  if (!tokenRes.ok || !tokenRes.data) {
    capabilities.tokenAuthentication = tokenRes.capabilityState || 'failed';
    const state = saveGrainIntegrationMeta({
      connected: false,
      capabilities,
      lastProbeRecordingsCount: null,
      lastDiagnostics: [],
      lastError: tokenRes.errorMessage || 'Token validation failed.',
      lastErrorCode: tokenRes.errorCode || 'INVALID_TOKEN'
    });
    return { connected: false, state, error: state.lastError || undefined };
  }

  capabilities.tokenAuthentication = 'available_tested';
  const scope = String(tokenRes.data.scope || tokenRes.data.type || 'personal').toLowerCase();
  const isPersonalScope = scope.includes('personal');
  capabilities.personalApiScope = isPersonalScope ? 'available_tested' : 'unknown';

  // 2. Run 4-Step Recording Discovery Isolation Sequence (Test A, Test B, Test C, Test D)
  const diag = await runGrainRecordingDiscoveryDiagnostics();
  const stepA = diag.steps[0];
  const stepB = diag.steps[1];
  const stepD = diag.steps[3];

  // If Test A failed, classify accurately using Section 5 rules (never classify 400 bad_request as restricted!)
  if (!stepA || stepA.errorCode !== null) {
    const failedOutcome = classifyGrainOperationOutcome({
      operation: 'list_recordings',
      httpStatus: stepA?.httpStatus || 0,
      parsedData: diag.testAResponseData
    });
    capabilities.recordingDiscovery = failedOutcome.capabilityState;
    if (stepA?.httpStatus === 401) {
      capabilities.tokenAuthentication = 'failed';
    }
    const state = saveGrainIntegrationMeta({
      connected: stepA?.httpStatus !== 401,
      tokenScope: scope,
      grainUserId: tokenRes.data.user_id ? String(tokenRes.data.user_id) : null,
      tokenName: tokenRes.data.name ? String(tokenRes.data.name) : null,
      lastProbeRecordingsCount: null,
      lastDiagnostics: diag.steps,
      capabilities,
      lastError: stepA?.sanitizedMessage || failedOutcome.errorMessage || 'Recording discovery failed.',
      lastErrorCode: stepA?.errorCode || failedOutcome.errorCode || 'BAD_REQUEST'
    });
    return { connected: state.connected, state, error: state.lastError || undefined };
  }

  // Test A succeeded with HTTP 200 and a valid recordings array (even if 0 recordings!)
  capabilities.recordingDiscovery = 'available_tested';

  const rawRecordingsA = Array.isArray(diag.testAResponseData?.recordings)
    ? diag.testAResponseData.recordings
    : Array.isArray(diag.testAResponseData?.data)
    ? diag.testAResponseData.data
    : [];

  const rawRecordingsB = Array.isArray(diag.testBResponseData?.recordings)
    ? diag.testBResponseData.recordings
    : Array.isArray(diag.testBResponseData?.data)
    ? diag.testBResponseData.data
    : [];

  const effectiveRecordings = rawRecordingsB.length > 0 ? rawRecordingsB : rawRecordingsA;

  // Pagination classification
  if (stepD && !stepD.skipped && stepD.errorCode === null && stepD.hasRecordingsArray) {
    capabilities.pagination = 'available_tested';
  } else if ('cursor' in (diag.testAResponseData || {}) || 'next_cursor' in (diag.testAResponseData || {})) {
    capabilities.pagination = effectiveRecordings.length > 0 ? 'available_untested' : 'unknown';
  } else {
    capabilities.pagination = 'unknown';
  }

  if (effectiveRecordings.length > 0) {
    const sample = effectiveRecordings[0];
    const sampleId = String(sample?.id || '').trim();

    const hasUrl = Boolean(sample?.public_url || sample?.url || sample?.share_url);
    capabilities.recordingUrls = hasUrl ? 'available_tested' : 'unknown';

    if (stepB && stepB.errorCode === null && Array.isArray(sample?.participants)) {
      capabilities.participants = 'available_tested';
    } else if (stepB && (stepB.httpStatus === 402 || stepB.httpStatus === 403)) {
      capabilities.participants = 'restricted';
    } else {
      capabilities.participants = 'unknown';
    }

    // Probe Recording Details with calendar_event and ai_summary on the first recording
    if (sampleId) {
      const detailRes = await executeScopedGrainOperation({
        operation: 'recording_details',
        recordingId: sampleId,
        payload: {
          include: {
            participants: true,
            ai_summary: true,
            calendar_event: true
          }
        }
      });

      const detailObj = detailRes.ok && detailRes.data ? detailRes.data : sample;
      const hasCalendarOrZoom = Boolean(
        detailObj?.calendar_event ||
          detailObj?.zoom_meeting_url ||
          detailObj?.meeting_url ||
          detailObj?.source === 'zoom'
      );
      capabilities.zoomCalendarMetadata = hasCalendarOrZoom ? 'available_tested' : 'unknown';

      const summaryText = extractGrainAiSummaryText(detailObj?.ai_summary);
      if (summaryText) {
        capabilities.aiSummaries = 'available_tested';
      } else if (detailObj && 'ai_summary' in detailObj) {
        capabilities.aiSummaries = 'available_untested';
      } else if (detailRes.httpStatus === 402 || detailRes.httpStatus === 403) {
        capabilities.aiSummaries = detailRes.capabilityState || 'restricted';
      } else {
        capabilities.aiSummaries = 'unknown';
      }

      // Probe Transcript access on the sample recording
      const trRes = await executeScopedGrainOperation({
        operation: 'recording_transcript',
        recordingId: sampleId
      });
      if (trRes.ok && trRes.data) {
        capabilities.transcriptAccess = 'available_tested';
      } else if (trRes.httpStatus === 402 || trRes.httpStatus === 403) {
        capabilities.transcriptAccess = trRes.capabilityState || 'restricted';
      } else {
        capabilities.transcriptAccess = 'unknown';
      }
    }
  } else {
    // HTTP 200 with 0 recordings: Recording Discovery is available_tested (with 0 results),
    // while per-recording capabilities remain 'unknown' (never marked available merely because auth succeeded).
    capabilities.recordingUrls = 'unknown';
    capabilities.zoomCalendarMetadata = 'unknown';
    capabilities.participants = 'unknown';
    capabilities.aiSummaries = 'unknown';
    capabilities.transcriptAccess = 'unknown';
  }

  const state = saveGrainIntegrationMeta({
    connected: true,
    hasToken: true,
    tokenScope: scope,
    grainUserId: tokenRes.data.user_id ? String(tokenRes.data.user_id) : null,
    tokenName: tokenRes.data.name ? String(tokenRes.data.name) : null,
    lastProbeRecordingsCount: effectiveRecordings.length,
    lastDiagnostics: diag.steps,
    capabilities,
    lastError: null,
    lastErrorCode: null
  });

  return { connected: true, state };
}

// ==========================================
// PART 2 (FIX-1): PUBLIC GRAIN RECORDING LINK VERIFICATION FOR PARENTS
// ==========================================

/**
 * Checks whether a URL is a valid Grain web recording/share page URL rather than:
 * - A Zoom meeting URL
 * - A Grain API endpoint (`/_/public-api/`)
 * - A transcript download endpoint (`/transcript`)
 * - A raw video download URL (`.mp4`, `.webm`, `/download`)
 * - An internal Glück route
 */
export function isGrainRecordingUrl(rawUrl?: string | null): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    const isGrainHost =
      host === 'grain.com' ||
      host.endsWith('.grain.com') ||
      host === 'grain.co' ||
      host.endsWith('.grain.co');
    if (!isGrainHost) return false;
    if (host === 'api.grain.com' || host === 'api.grain.co') return false;

    const pathname = u.pathname.toLowerCase();
    // Reject API endpoints, transcript downloads, or raw video file downloads
    if (
      pathname.includes('/_/public-api') ||
      pathname.includes('/public-api/') ||
      pathname.endsWith('/transcript') ||
      pathname.includes('/transcript/') ||
      pathname.endsWith('/download') ||
      /\.(mp4|webm|m4a|mp3|vtt|srt|json)$/i.test(pathname)
    ) {
      return false;
    }
    return pathname.length > 1;
  } catch {
    return false;
  }
}

/**
 * Part 2 (FIX-1): Classifies a Grain recording's sharing/access permissions into:
 * 1. "public_access_verified" — Confirmed public/external link accessible without a Grain account or workspace login.
 * 2. "workspace_only" — Restricted to members of the teacher's Grain workspace.
 * 3. "restricted" — Private / restricted to owners or invited participants only.
 * 4. "unknown" — Grain returned a valid recording URL, but did not confirm public sharing state.
 * 5. "link_unavailable" — URL is missing, invalid, a Zoom link, an API endpoint, a transcript download, or raw video.
 *
 * Rules:
 * - Never assume a URL is publicly accessible merely because Grain returns `url` or `public_url`.
 * - Never treat `"workspace"` as public.
 * - Never automatically change sharing permissions.
 */
export function classifyGrainRecordingShareAccess(rawInput: {
  url?: string | null;
  public_url?: string | null;
  share_url?: string | null;
  recordingUrl?: string | null;
  share_state?: string | null;
  rawShareState?: string | null;
  sharing?: any;
  access_level?: string | null;
  visibility?: string | null;
  is_public?: boolean | null;
  public_access?: boolean | null;
  teacherVerifiedPublic?: boolean | null;
} | null | undefined): {
  classification: GrainShareAccessClassification;
  rawShareState?: string;
  validGrainPageUrl: string | null;
} {
  if (!rawInput || typeof rawInput !== 'object') {
    return { classification: 'link_unavailable', validGrainPageUrl: null };
  }

  const candidateUrl = String(
    rawInput.recordingUrl ||
      rawInput.share_url ||
      rawInput.public_url ||
      rawInput.url ||
      ''
  ).trim();

  if (!candidateUrl || !isGrainRecordingUrl(candidateUrl)) {
    return { classification: 'link_unavailable', validGrainPageUrl: null };
  }

  const rawStateCandidate =
    rawInput.share_state ??
    rawInput.rawShareState ??
    (typeof rawInput.sharing === 'string'
      ? rawInput.sharing
      : rawInput.sharing?.state || rawInput.sharing?.share_state || rawInput.sharing?.access_level || rawInput.sharing?.visibility) ??
    rawInput.access_level ??
    rawInput.visibility ??
    '';

  const normState = String(rawStateCandidate || '').trim().toLowerCase();

  // Explicit boolean flags if provided by Grain or verified by teacher
  if (rawInput.is_public === false || rawInput.public_access === false) {
    if (normState.includes('workspace') || normState.includes('team') || normState.includes('org') || normState === 'internal') {
      return { classification: 'workspace_only', rawShareState: normState || 'workspace', validGrainPageUrl: candidateUrl };
    }
    return { classification: 'restricted', rawShareState: normState || 'restricted', validGrainPageUrl: candidateUrl };
  }

  if (
    normState === 'public' ||
    normState === 'anyone_with_link' ||
    normState === 'anyone' ||
    normState === 'public_link' ||
    normState === 'external' ||
    normState === 'unlisted_public' ||
    rawInput.is_public === true ||
    rawInput.public_access === true ||
    rawInput.teacherVerifiedPublic === true
  ) {
    return {
      classification: 'public_access_verified',
      rawShareState: normState || 'public',
      validGrainPageUrl: candidateUrl
    };
  }

  if (
    normState === 'workspace' ||
    normState === 'workspace_only' ||
    normState === 'internal' ||
    normState === 'team' ||
    normState === 'organization' ||
    normState === 'company'
  ) {
    return {
      classification: 'workspace_only',
      rawShareState: normState,
      validGrainPageUrl: candidateUrl
    };
  }

  if (
    normState === 'private' ||
    normState === 'restricted' ||
    normState === 'owners_only' ||
    normState === 'owner' ||
    normState === 'invited' ||
    normState === 'participants_only' ||
    normState === 'none' ||
    normState === 'disabled'
  ) {
    return {
      classification: 'restricted',
      rawShareState: normState,
      validGrainPageUrl: candidateUrl
    };
  }

  // If no explicit share_state metadata was returned, do NOT assume public_url is public!
  return {
    classification: 'unknown',
    rawShareState: normState || undefined,
    validGrainPageUrl: candidateUrl
  };
}

/**
 * Part 2 (FIX-1): Returns true ONLY if the URL is a valid Grain recording page AND its share classification
 * is `'public_access_verified'`, or if it is a non-Grain external recording link (e.g. YouTube/Drive) that is not a Zoom meeting link.
 * For Grain links, only `'public_access_verified'` may be presented as parent-accessible without login.
 */
export function isParentReadyPublicGrainLink(
  rawUrl?: string | null,
  classification?: GrainShareAccessClassification | null
): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  // Never allow a Zoom meeting URL, Grain API endpoint, transcript download, or raw video download
  if (normalizeZoomMeetingUrl(trimmed)) return false;
  if (/\/_\/public-api\/|\/public-api\/|\/transcript(\/|$)|\.(mp4|webm|m4a|vtt|srt)(\?|$)/i.test(trimmed)) {
    return false;
  }
  if (isGrainRecordingUrl(trimmed)) {
    return classification === 'public_access_verified';
  }
  return false;
}

/**
 * Resolves the share access classification for a lesson's primary or secondary recording link.
 */
export function getLessonRecordingShareClassification(
  lesson: Lesson,
  slot: 'recordingLink' | 'recordingLink2' = 'recordingLink',
  discoveredRecordings?: GrainDiscoveredRecording[]
): GrainShareAccessClassification {
  const rawUrl =
    slot === 'recordingLink'
      ? (lesson.recordingLink || lesson.report?.recordingLink || lesson.grainMeta?.recordingUrl || '').trim()
      : (lesson.recordingLink2 || lesson.report?.recordingLink2 || lesson.grainMeta?.recordingUrlPart2 || '').trim();

  if (!rawUrl || !isGrainRecordingUrl(rawUrl)) {
    return 'link_unavailable';
  }

  const metaClass =
    slot === 'recordingLink'
      ? lesson.grainMeta?.shareAccessClassification || lesson.report?.grainMeta?.shareAccessClassification
      : lesson.grainMeta?.shareAccessClassificationPart2 || lesson.report?.grainMeta?.shareAccessClassificationPart2;

  if (metaClass) {
    return metaClass;
  }

  const list = discoveredRecordings || loadDiscoveredGrainRecordings({ includeRemoved: true });
  const recId = slot === 'recordingLink' ? lesson.grainMeta?.recordingId : lesson.grainMeta?.recordingIdPart2;
  const matchedRec = list.find((r) => (recId && r.id === recId) || r.recordingUrl.trim() === rawUrl);
  if (matchedRec?.shareAccessClassification) {
    return matchedRec.shareAccessClassification;
  }

  return 'unknown';
}

// ==========================================
// PART 10: SMART GROUP LEARNING ENGINE (`GrainGroupLearningRecord`)
// ==========================================

export function sanitizeGrainGroupLearningRecord(raw: any, activeGroups?: Group[]): GrainGroupLearningRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || '').trim();
  const grainRecordingId = String(raw.grainRecordingId || '').trim();
  const lessonId = String(raw.lessonId || '').trim();
  const groupId = String(raw.groupId || '').trim();
  if (!id || !grainRecordingId || !lessonId || !groupId) return null;

  let obsoleteGroup = Boolean(raw.obsoleteGroup);
  if (Array.isArray(activeGroups) && activeGroups.length > 0) {
    const groupExists = activeGroups.some((g) => g && !g.deleted && g.id === groupId);
    if (!groupExists) {
      obsoleteGroup = true;
    }
  }

  const correctionHistory: GrainGroupLearningCorrectionEntry[] | undefined = Array.isArray(raw.correctionHistory)
    ? raw.correctionHistory
        .filter((c: any) => c && typeof c === 'object' && typeof c.chosenGroupId === 'string')
        .slice(0, 15)
        .map((c: any) => ({
          correctedAt: String(c.correctedAt || new Date().toISOString()),
          ...(typeof c.previousSuggestedGroupId === 'string' && c.previousSuggestedGroupId
            ? { previousSuggestedGroupId: c.previousSuggestedGroupId.slice(0, 128) }
            : {}),
          chosenGroupId: String(c.chosenGroupId).slice(0, 128),
          chosenLessonId: String(c.chosenLessonId || lessonId).slice(0, 128)
        }))
    : undefined;

  return {
    id: redactGrainSecrets(id).slice(0, 128),
    grainRecordingId: redactGrainSecrets(grainRecordingId).slice(0, 128),
    lessonId: redactGrainSecrets(lessonId).slice(0, 128),
    groupId: redactGrainSecrets(groupId).slice(0, 128),
    studentIds: Array.isArray(raw.studentIds)
      ? raw.studentIds.map((s: any) => String(s || '').trim().slice(0, 128)).filter(Boolean).slice(0, 50)
      : [],
    recordingDate: String(raw.recordingDate || '').slice(0, 10),
    recordingDayOfWeek: Number.isFinite(Number(raw.recordingDayOfWeek)) ? Number(raw.recordingDayOfWeek) : 0,
    recordingStartTime: String(raw.recordingStartTime || '00:00').slice(0, 8),
    recordingDuration: Math.max(1, Number(raw.recordingDuration) || 60),
    normalizedTitle: redactGrainSecrets(String(raw.normalizedTitle || '')).slice(0, 160),
    participantSignatures: Array.isArray(raw.participantSignatures)
      ? raw.participantSignatures.map((p: any) => normalizeNameForComparison(String(p || '')).slice(0, 60)).filter(Boolean).slice(0, 25)
      : [],
    matchingEvidence: Array.isArray(raw.matchingEvidence)
      ? raw.matchingEvidence.map((m: any) => redactGrainSecrets(String(m || '')).slice(0, 140)).filter(Boolean).slice(0, 10)
      : [],
    teacherConfirmed: Boolean(raw.teacherConfirmed),
    confirmedAt: String(raw.confirmedAt || new Date().toISOString()),
    ...(obsoleteGroup ? { obsoleteGroup: true } : {}),
    ...(correctionHistory && correctionHistory.length > 0 ? { correctionHistory } : {})
  };
}

export function loadGrainGroupLearningRecords(activeGroups?: Group[]): GrainGroupLearningRecord[] {
  let rawList: any[] = inMemoryGroupLearningRecordsFallback;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(GRAIN_GROUP_LEARNING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        }
      }
    } catch {
      // Fallback to in-memory
    }
  }
  const sanitized = rawList
    .map((item) => sanitizeGrainGroupLearningRecord(item, activeGroups))
    .filter((item): item is GrainGroupLearningRecord => Boolean(item));
  inMemoryGroupLearningRecordsFallback = sanitized;
  return sanitized;
}

export function saveGrainGroupLearningRecords(records: GrainGroupLearningRecord[], activeGroups?: Group[]): GrainGroupLearningRecord[] {
  const sanitized = (records || [])
    .map((item) => sanitizeGrainGroupLearningRecord(item, activeGroups))
    .filter((item): item is GrainGroupLearningRecord => Boolean(item))
    .slice(0, 300);

  inMemoryGroupLearningRecordsFallback = sanitized;
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GRAIN_GROUP_LEARNING_STORAGE_KEY, JSON.stringify(sanitized));
    } catch {
      // Ignore storage quota errors
    }
  }
  return sanitized;
}

export function __resetGrainGroupLearningForTesting(): void {
  inMemoryGroupLearningRecordsFallback = [];
  inMemoryRemovedLibraryIdsFallback.clear();
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(GRAIN_GROUP_LEARNING_STORAGE_KEY);
      localStorage.removeItem(GRAIN_REMOVED_LIBRARY_IDS_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Part 10.2 & 10.4 & 10.5: Records a teacher-confirmed recording-to-lesson/group match into
 * `GrainGroupLearningRecord` keyed by stable `group.id`.
 * - If the teacher chose a different lesson/group than suggested (`previousSuggestedGroupId !== lesson.groupId`),
 *   records a correction in `correctionHistory` so future matches prefer the teacher-confirmed group!
 * - Survives group name changes because `groupId` (`group.id`) is the primary key.
 */
export function recordConfirmedGrainGroupLearning(options: {
  recording: GrainDiscoveredRecording;
  lesson: Lesson;
  groups: Group[];
  students: Student[];
  previousSuggestedGroupId?: string;
}): GrainGroupLearningRecord | null {
  const { recording, lesson, groups, students } = options;
  const groupId = String(lesson.groupId || '').trim();
  if (!groupId) return null;

  const groupExists = (groups || []).some((g) => g && !g.deleted && g.id === groupId);
  const groupStudents = (students || []).filter(
    (s) => s && !s.deleted && (s.groupId === groupId || (lesson.studentId && s.id === lesson.studentId))
  );
  const studentIds = groupStudents.map((s) => s.id);

  const recTime = formatLocalYmdAndTimeFromIso(recording.startDatetime);
  const dt = new Date(recording.startDatetime);
  const dayOfWeek = !isNaN(dt.getTime()) ? dt.getDay() : 0;

  const existingRecords = loadGrainGroupLearningRecords(groups);
  const existingIdx = existingRecords.findIndex((r) => r.grainRecordingId === recording.id);
  const prevSuggestedGroupId =
    options.previousSuggestedGroupId ||
    recording.matchedGroupId ||
    (recording.suggestedLessonId
      ? (groups || []).find((g) => g.name === recording.candidates?.[0]?.groupName)?.id
      : undefined);

  const nowIso = new Date().toISOString();
  const prevHistory = existingIdx >= 0 ? existingRecords[existingIdx].correctionHistory || [] : [];
  const nextCorrections: GrainGroupLearningCorrectionEntry[] = [...prevHistory];

  if (prevSuggestedGroupId && prevSuggestedGroupId !== groupId) {
    nextCorrections.push({
      correctedAt: nowIso,
      previousSuggestedGroupId: prevSuggestedGroupId,
      chosenGroupId: groupId,
      chosenLessonId: lesson.id
    });
  }

  const newRecord: GrainGroupLearningRecord = {
    id: existingIdx >= 0 ? existingRecords[existingIdx].id : `glr_${recording.id}_${groupId}`,
    grainRecordingId: recording.id,
    lessonId: lesson.id,
    groupId,
    studentIds,
    recordingDate: recTime.valid ? recTime.dateYmd : lesson.date,
    recordingDayOfWeek: dayOfWeek,
    recordingStartTime: recTime.valid ? recTime.timeHm : lesson.time,
    recordingDuration: recording.durationMinutes || lesson.durationMinutes || 60,
    normalizedTitle: normalizeNameForComparison(recording.title),
    participantSignatures: (recording.participantNames || [])
      .map(normalizeNameForComparison)
      .filter((p) => p.length >= 3)
      .slice(0, 20),
    matchingEvidence: (recording.matchReasons || []).slice(0, 8),
    teacherConfirmed: true,
    confirmedAt: nowIso,
    ...(groupExists ? {} : { obsoleteGroup: true }),
    ...(nextCorrections.length > 0 ? { correctionHistory: nextCorrections } : {})
  };

  const nextList = [...existingRecords];
  if (existingIdx >= 0) {
    nextList[existingIdx] = newRecord;
  } else {
    nextList.unshift(newRecord);
  }

  saveGrainGroupLearningRecords(nextList, groups);
  return newRecord;
}

/**
 * Evaluates Smart Group Learning history for a candidate group (`group.id`) on a given recording.
 * - Checks active (non-obsolete) teacher-confirmed learning records for `group.id`.
 * - Compares day-of-week + start-time window, recurring participant signatures, and normalized title patterns.
 * - Penalizes a group if the teacher previously corrected away from it (`previousSuggestedGroupId === groupId`) at that time slot.
 * - Never matches or boosts deleted/obsolete groups (`obsoleteGroup: true`).
 */
export function evaluateGroupLearningBoostForCandidate(options: {
  groupId: string;
  recordingDayOfWeek: number;
  recordingMinutesOfDay: number;
  recordingDurationMinutes: number;
  normalizedTitle: string;
  normalizedParticipants: string[];
  learningRecords: GrainGroupLearningRecord[];
  activeGroups: Group[];
}): { boostPoints: number; reasons: string[] } {
  const {
    groupId,
    recordingDayOfWeek,
    recordingMinutesOfDay,
    recordingDurationMinutes,
    normalizedTitle,
    normalizedParticipants,
    learningRecords,
    activeGroups
  } = options;

  if (!groupId) return { boostPoints: 0, reasons: [] };
  const isGroupActive = activeGroups.some((g) => g && !g.deleted && g.status !== 'archived' && g.id === groupId);
  if (!isGroupActive) {
    return { boostPoints: 0, reasons: [] };
  }

  let boost = 0;
  const reasons: string[] = [];

  const confirmedForGroup = learningRecords.filter(
    (r) => r.teacherConfirmed && !r.obsoleteGroup && r.groupId === groupId
  );

  if (confirmedForGroup.length > 0) {
    // 1. Check Day-of-Week + Start-Time slot alignment with previous teacher confirmations for this group.id
    const timeSlotMatches = confirmedForGroup.filter((r) => {
      if (r.recordingDayOfWeek !== recordingDayOfWeek) return false;
      const [hh, mm] = String(r.recordingStartTime || '00:00').split(':').map(Number);
      if (!Number.isFinite(hh) || !Number.isFinite(mm)) return false;
      const learnedMin = hh * 60 + mm;
      return Math.abs(learnedMin - recordingMinutesOfDay) <= 35;
    });

    if (timeSlotMatches.length > 0) {
      boost += 14;
      reasons.push(`Smart Group Learning: matches confirmed schedule slot for this group (${timeSlotMatches.length} prior confirmation(s))`);
    }

    // 2. Check recurring participant signatures confirmed for this group.id
    if (normalizedParticipants.length > 0) {
      const learnedParticipants = new Set<string>();
      for (const r of confirmedForGroup) {
        for (const sig of r.participantSignatures || []) {
          if (sig.length >= 3) learnedParticipants.add(sig);
        }
      }
      let sigOverlap = 0;
      for (const p of normalizedParticipants) {
        if (learnedParticipants.has(p) || Array.from(learnedParticipants).some((lp) => lp.includes(p) || p.includes(lp))) {
          sigOverlap++;
        }
      }
      if (sigOverlap > 0) {
        boost += Math.min(8, sigOverlap * 4);
        reasons.push(`Smart Group Learning: ${sigOverlap} participant(s) match previously confirmed group sessions`);
      }
    }

    // 3. Check normalized title pattern from prior confirmed sessions (stable across group renames because keyed by groupId)
    if (normalizedTitle.length >= 3) {
      const titleMatched = confirmedForGroup.some(
        (r) =>
          r.normalizedTitle &&
          r.normalizedTitle.length >= 3 &&
          (normalizedTitle.includes(r.normalizedTitle) || r.normalizedTitle.includes(normalizedTitle))
      );
      if (titleMatched) {
        boost += 6;
        reasons.push('Smart Group Learning: recording title pattern matches prior confirmed sessions for this group');
      }
    }

    // 4. Duration similarity with learned group duration
    const durMatched = confirmedForGroup.some((r) => Math.abs((r.recordingDuration || 60) - recordingDurationMinutes) <= 15);
    if (durMatched && boost > 0) {
      boost += 2;
    }
  }

  // 5. Check correction history across all records: if teacher explicitly corrected AWAY from this groupId at this day/time slot, penalize it
  const correctedAwayCount = learningRecords.filter((r) => {
    if (r.recordingDayOfWeek !== recordingDayOfWeek) return false;
    const [hh, mm] = String(r.recordingStartTime || '00:00').split(':').map(Number);
    const learnedMin = (Number.isFinite(hh) ? hh : 0) * 60 + (Number.isFinite(mm) ? mm : 0);
    if (Math.abs(learnedMin - recordingMinutesOfDay) > 45) return false;
    return (r.correctionHistory || []).some(
      (c) => c.previousSuggestedGroupId === groupId && c.chosenGroupId !== groupId
    );
  }).length;

  if (correctedAwayCount > 0) {
    boost -= Math.min(18, correctedAwayCount * 10);
    reasons.push('Smart Group Learning: teacher previously reassigned this time slot to another group');
  }

  return {
    boostPoints: Math.max(-18, Math.min(24, boost)),
    reasons
  };
}

// ==========================================
// PART 9: SMART LESSON MATCHING WITHOUT REQUIRED ZOOM LINKS
// ==========================================

/**
 * Safely normalizes a Zoom meeting URL for comparison without discarding meaningful meeting identifiers.
 * Returns null if the URL is a Grain recording URL, invalid, or not a Zoom meeting URL.
 */
export function normalizeZoomMeetingUrl(rawUrl?: string | null): {
  canonicalUrl: string;
  meetingId: string | null;
} | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || isGrainRecordingUrl(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    const isZoomHost = host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com');
    if (!isZoomHost) {
      return null;
    }

    // Extract numeric meeting ID from /j/<id>, /wc/<id>, /w/<id>, /s/<id> or ?confno=<id>
    const pathMatch = /\/(?:j|wc|w|s)\/(\d{8,13})/i.exec(parsed.pathname);
    const confnoParam = parsed.searchParams.get('confno');
    const meetingId = pathMatch?.[1] || (confnoParam && /^\d{8,13}$/.test(confnoParam) ? confnoParam : null);

    // Normalize path (strip trailing slashes, keep personal meeting room name like /my/roomname if no numeric ID)
    const cleanPath = parsed.pathname.replace(/\/+$/, '');
    if (meetingId) {
      return {
        canonicalUrl: `https://zoom.us/j/${meetingId}`,
        meetingId
      };
    }
    if (cleanPath && cleanPath !== '/') {
      return {
        canonicalUrl: `https://${host}${cleanPath.toLowerCase()}`,
        meetingId: null
      };
    }
    return null;
  } catch {
    return null;
  }
}

function parseLessonDateTimeMinutes(dateStr: string, timeStr?: string): {
  valid: boolean;
  dateYmd: string;
  minutesOfDay: number;
  epochMsLocal: number;
} {
  const cleanDate = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return { valid: false, dateYmd: '', minutesOfDay: 0, epochMsLocal: 0 };
  }

  let hours = 0;
  let minutes = 0;
  const rawTime = String(timeStr || '00:00').trim();
  const amPmMatch = /^(\d{1,2}):(\d{2})\s*(AM|PM|ص|م)?$/i.exec(rawTime);
  if (amPmMatch) {
    hours = parseInt(amPmMatch[1], 10);
    minutes = parseInt(amPmMatch[2], 10);
    const mer = (amPmMatch[3] || '').toUpperCase();
    if ((mer === 'PM' || mer === 'م') && hours < 12) hours += 12;
    if ((mer === 'AM' || mer === 'ص') && hours === 12) hours = 0;
  }

  const [y, m, d] = cleanDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hours, minutes, 0, 0);
  return {
    valid: !isNaN(dt.getTime()),
    dateYmd: cleanDate,
    minutesOfDay: hours * 60 + minutes,
    epochMsLocal: dt.getTime()
  };
}

function formatLocalYmdAndTimeFromIso(isoStr: string): {
  valid: boolean;
  dateYmd: string;
  timeHm: string;
  minutesOfDay: number;
  dayOfWeek: number;
  epochMs: number;
  utcDateYmd: string;
  utcMinutesOfDay: number;
} {
  const dt = new Date(isoStr);
  if (isNaN(dt.getTime())) {
    return {
      valid: false,
      dateYmd: '',
      timeHm: '',
      minutesOfDay: 0,
      dayOfWeek: 0,
      epochMs: 0,
      utcDateYmd: '',
      utcMinutesOfDay: 0
    };
  }
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');

  const utcY = dt.getUTCFullYear();
  const utcM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const utcD = String(dt.getUTCDate()).padStart(2, '0');

  return {
    valid: true,
    dateYmd: `${yyyy}-${mm}-${dd}`,
    timeHm: `${hh}:${min}`,
    minutesOfDay: dt.getHours() * 60 + dt.getMinutes(),
    dayOfWeek: dt.getDay(),
    epochMs: dt.getTime(),
    utcDateYmd: `${utcY}-${utcM}-${utcD}`,
    utcMinutesOfDay: dt.getUTCHours() * 60 + dt.getUTCMinutes()
  };
}

function normalizeNameForComparison(name?: string | null): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Part 9 & Part 10: Evaluates a single Grain recording against all candidate Glück lessons.
 * - Zoom meeting link is optional supporting evidence — NEVER required!
 * - Primary matching evidence:
 *   1. Lesson date & Lesson start time vs Recording start time
 *   2. Existing Glück student-to-group relationship (`student.groupId === lesson.groupId`)
 *   3. Grain participant/student identity when aligned with date/time/group
 *   4. Smart Group Learning history (`GrainGroupLearningRecord` keyed by stable `group.id`)
 * - Secondary evidence:
 *   1. Recording title & calendar metadata
 *   2. Zoom meeting URL (if available)
 *   3. Recording duration (including split segments)
 * - Safety rules:
 *   - Never infer attendance from participants.
 *   - Never assign based on student name alone when date/time or group conflicts.
 */
export function evaluateRecordingMatchAgainstLessons(
  recording: {
    id: string;
    title: string;
    startDatetime: string;
    endDatetime?: string;
    durationSeconds: number;
    recordingUrl: string;
    shareAccessClassification?: GrainShareAccessClassification;
    rawShareState?: string;
    sourcePlatform: string;
    zoomMeetingUrl?: string;
    calendarEventTitle?: string;
    participantNames?: string[];
    hasAiSummary?: boolean;
    aiSummaryExcerpt?: string;
    importedAt?: string;
    removedFromLibrary?: boolean;
  },
  lessons: Lesson[],
  groups: Group[],
  students: Student[],
  explicitLearningRecords?: GrainGroupLearningRecord[]
): GrainDiscoveredRecording {
  const durationMinutes = Math.max(1, Math.round((recording.durationSeconds || 0) / 60));
  const cleanRecUrl = String(recording.recordingUrl || '').trim();

  const shareInfo = classifyGrainRecordingShareAccess({
    recordingUrl: cleanRecUrl,
    share_state: recording.rawShareState,
    teacherVerifiedPublic: recording.shareAccessClassification === 'public_access_verified'
  });
  const effectiveShareClassification: GrainShareAccessClassification =
    recording.shareAccessClassification || shareInfo.classification;

  if (!cleanRecUrl) {
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: 'link_unavailable',
      matchStatus: 'inaccessible',
      confidenceScore: 0,
      matchReasons: ['Recording URL is missing or inaccessible in Grain.'],
      candidates: [],
      lastSyncedAt: new Date().toISOString()
    };
  }

  const activeGroups = (groups || []).filter((g) => g && !g.deleted);
  const learningRecords = explicitLearningRecords || loadGrainGroupLearningRecords(activeGroups);

  // Check if already linked to any non-deleted lesson
  const activeLessons = (lessons || []).filter((l) => l && !l.deleted && l.status !== 'cancelled');
  const alreadyLinkedLesson = activeLessons.find((l) => {
    const r1 = (l.recordingLink || l.report?.recordingLink || '').trim();
    const r2 = (l.recordingLink2 || l.report?.recordingLink2 || '').trim();
    const gId1 = l.grainMeta?.recordingId;
    const gId2 = l.grainMeta?.recordingIdPart2;
    return (
      (r1 && r1 === cleanRecUrl) ||
      (r2 && r2 === cleanRecUrl) ||
      (gId1 && gId1 === recording.id) ||
      (gId2 && gId2 === recording.id)
    );
  });

  const recTime = formatLocalYmdAndTimeFromIso(recording.startDatetime);
  const normalizedGrainZoom = normalizeZoomMeetingUrl(recording.zoomMeetingUrl);
  const normRecTitle = normalizeNameForComparison(`${recording.title} ${recording.calendarEventTitle || ''}`);
  const normParticipants = (recording.participantNames || []).map(normalizeNameForComparison).filter(Boolean);

  const candidates: GrainLessonMatchCandidate[] = [];

  for (const lesson of activeLessons) {
    const lessonTime = parseLessonDateTimeMinutes(lesson.date, lesson.time);
    if (!lessonTime.valid || !recTime.valid) continue;

    // Account for local date/time as well as timezone offsets up to ±3 hours around midnight
    const epochDiffMinutes = Math.round(Math.abs(recTime.epochMs - lessonTime.epochMsLocal) / 60000);
    const sameLocalDate = recTime.dateYmd === lessonTime.dateYmd;
    const sameUtcDate = recTime.utcDateYmd === lessonTime.dateYmd;
    const localClockDiff = Math.abs(recTime.minutesOfDay - lessonTime.minutesOfDay);
    const utcClockDiff = Math.abs(recTime.utcMinutesOfDay - lessonTime.minutesOfDay);

    const effectiveTimeDeltaMinutes = sameLocalDate
      ? localClockDiff
      : sameUtcDate
      ? Math.min(epochDiffMinutes, utcClockDiff)
      : epochDiffMinutes;

    const lessonDuration = Math.max(15, Number(lesson.durationMinutes || lesson.duration || 60));
    const isDateAndTimeAligned =
      (sameLocalDate || sameUtcDate || epochDiffMinutes <= 180) &&
      effectiveTimeDeltaMinutes <= Math.max(75, lessonDuration + 20);

    // Rule 1 & Part 9.3: Never assign a recording based on student/participant name or title alone when date/time conflicts!
    if (!isDateAndTimeAligned) {
      continue;
    }

    const group = activeGroups.find((g) => g.id === lesson.groupId);
    const rawLessonZoom = lesson.zoomMeetingLink || lesson.meetingLink || group?.zoomLink || '';
    const normalizedLessonZoom = normalizeZoomMeetingUrl(rawLessonZoom);

    let zoomLinkStatus: GrainZoomLinkVerificationStatus = 'not_exposed_by_grain';
    if (!normalizedLessonZoom) {
      zoomLinkStatus = 'missing_on_lesson';
    } else if (!normalizedGrainZoom) {
      zoomLinkStatus = 'not_exposed_by_grain';
    } else {
      const idMatch =
        normalizedLessonZoom.meetingId &&
        normalizedGrainZoom.meetingId &&
        normalizedLessonZoom.meetingId === normalizedGrainZoom.meetingId;
      const urlMatch = normalizedLessonZoom.canonicalUrl === normalizedGrainZoom.canonicalUrl;
      zoomLinkStatus = idMatch || urlMatch ? 'verified_match' : 'mismatch';
    }

    if (zoomLinkStatus === 'mismatch' && effectiveTimeDeltaMinutes > 30) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    // 1. Primary Evidence: Lesson Date & Start Time alignment (up to 64 points — strong match possible without Zoom link!)
    if (effectiveTimeDeltaMinutes <= 10) {
      score += 64;
      reasons.push(`Exact date & start time match (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    } else if (effectiveTimeDeltaMinutes <= 25) {
      score += 52;
      reasons.push(`Date & close start time match (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    } else if (effectiveTimeDeltaMinutes <= 50) {
      score += 36;
      reasons.push(`Date & overlapping session window (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    } else {
      score += 22;
      reasons.push(`Same date within extended window (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    }

    // 2. Primary Evidence: Student-to-Group Relationship & Participant Identity (up to 16 points)
    const lessonStudents = (students || []).filter(
      (s) =>
        s &&
        !s.deleted &&
        ((lesson.groupId && s.groupId === lesson.groupId) || (lesson.studentId && s.id === lesson.studentId))
    );
    const matchedStudentIds: string[] = [];
    for (const st of lessonStudents) {
      const stNames = [st.name, st.nameEn, st.nameAr, st.displayNameEn, st.displayNameAr]
        .map(normalizeNameForComparison)
        .filter((n) => n.length >= 3);
      const matchedInParticipants = stNames.some((sn) =>
        normParticipants.some((pn) => pn.includes(sn) || sn.includes(pn))
      );
      const matchedInTitle = stNames.some((sn) => normRecTitle.includes(sn));
      if (matchedInParticipants || matchedInTitle) {
        matchedStudentIds.push(st.id);
      }
    }

    if (matchedStudentIds.length > 0) {
      const studentRelationshipBoost = Math.min(16, 10 + (matchedStudentIds.length - 1) * 3);
      score += studentRelationshipBoost;
      if (lesson.groupId && group) {
        reasons.push(
          `Matched ${matchedStudentIds.length} student(s) belonging to group "${group.name}"`
        );
      } else {
        reasons.push(`Matched individual lesson student identity`);
      }
    }

    // 3. Primary/Learned Evidence: Smart Group Learning History (Part 10 — keyed by stable group.id)
    let learnedGroupMatchBoost = 0;
    if (lesson.groupId) {
      const learnedEval = evaluateGroupLearningBoostForCandidate({
        groupId: lesson.groupId,
        recordingDayOfWeek: recTime.dayOfWeek,
        recordingMinutesOfDay: recTime.minutesOfDay,
        recordingDurationMinutes: durationMinutes,
        normalizedTitle: normRecTitle,
        normalizedParticipants: normParticipants,
        learningRecords,
        activeGroups
      });
      learnedGroupMatchBoost = learnedEval.boostPoints;
      if (learnedGroupMatchBoost !== 0) {
        score += learnedGroupMatchBoost;
        reasons.push(...learnedEval.reasons);
      }
    }

    // 4. Secondary Evidence: Duration consistency (up to 14 points)
    const durationDiff = Math.abs(durationMinutes - lessonDuration);
    const isLikelySplitPart = Math.abs(durationMinutes - Math.round(lessonDuration / 2)) <= 12;
    if (durationDiff <= 15) {
      score += 14;
      reasons.push(`Duration matches lesson (${durationMinutes}m vs ${lessonDuration}m)`);
    } else if (isLikelySplitPart) {
      score += 10;
      reasons.push(`Duration matches multi-part session segment (${durationMinutes}m of ${lessonDuration}m)`);
    } else if (durationDiff <= 30) {
      score += 6;
      reasons.push(`Duration reasonably close (${durationMinutes}m vs ${lessonDuration}m)`);
    }

    // 5. Secondary Evidence: Recording Title & Calendar Event Title (up to 10 points)
    const normLessonTitle = normalizeNameForComparison(lesson.title);
    const normGroupName = normalizeNameForComparison(group?.name || lesson.groupName);
    const normStudentName = normalizeNameForComparison(lesson.studentName);

    const secondaryTitleMatched = Boolean(
      (normGroupName && normGroupName.length >= 3 && normRecTitle.includes(normGroupName)) ||
        (normLessonTitle && normLessonTitle.length >= 3 && normRecTitle.includes(normLessonTitle)) ||
        (normStudentName && normStudentName.length >= 3 && normRecTitle.includes(normStudentName))
    );

    if (secondaryTitleMatched) {
      score += 10;
      reasons.push('Recording title supports lesson/group name');
    }

    // 6. Optional Secondary Supporting Evidence: Zoom Meeting URL (up to 15 points if present, 0 penalty if absent)
    if (zoomLinkStatus === 'verified_match') {
      score += 15;
      reasons.push(
        `Optional Zoom Meeting ID verified (${normalizedLessonZoom?.meetingId || normalizedLessonZoom?.canonicalUrl})`
      );
    } else if (zoomLinkStatus === 'mismatch') {
      score -= 22;
      reasons.push('Warning: Zoom Meeting ID differs from lesson Zoom link');
    }

    const clampedScore = Math.max(0, Math.min(100, score));

    const evidence: GrainMatchEvidence = {
      lessonDateMatch: sameLocalDate || sameUtcDate,
      recordingDateLocal: recTime.dateYmd,
      recordingStartTimeLocal: recTime.timeHm,
      timeDeltaMinutes: effectiveTimeDeltaMinutes,
      withinTimeWindow: isDateAndTimeAligned,
      zoomLinkStatus,
      normalizedLessonZoomId: normalizedLessonZoom?.meetingId || normalizedLessonZoom?.canonicalUrl,
      normalizedGrainZoomId: normalizedGrainZoom?.meetingId || normalizedGrainZoom?.canonicalUrl,
      durationMinutesRecording: durationMinutes,
      durationMinutesLesson: lessonDuration,
      durationDiffMinutes: durationDiff,
      secondaryTitleMatched,
      secondaryParticipantsMatchedCount: matchedStudentIds.length,
      matchedStudentIds: matchedStudentIds.length > 0 ? matchedStudentIds : undefined,
      matchedGroupId: lesson.groupId || undefined,
      learnedGroupMatchBoost: learnedGroupMatchBoost !== 0 ? learnedGroupMatchBoost : undefined,
      reasons
    };

    candidates.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title || group?.name || lesson.groupName,
      groupId: lesson.groupId || undefined,
      groupName: group?.name || lesson.groupName || '',
      studentId: lesson.studentId,
      studentName: lesson.studentName,
      lessonDate: lesson.date,
      lessonTime: lesson.time,
      lessonDurationMinutes: lessonDuration,
      confidenceScore: clampedScore,
      evidence,
      existingRecordingLink: (lesson.recordingLink || lesson.report?.recordingLink || '').trim() || undefined,
      existingRecordingLink2: (lesson.recordingLink2 || lesson.report?.recordingLink2 || '').trim() || undefined
    });
  }

  candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);

  if (alreadyLinkedLesson) {
    const linkedGroup = activeGroups.find((g) => g.id === alreadyLinkedLesson.groupId);
    const topCandidate = candidates.find((c) => c.lessonId === alreadyLinkedLesson.id) || candidates[0];
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: effectiveShareClassification,
      matchStatus: 'already_linked',
      suggestedLessonId: alreadyLinkedLesson.id,
      confirmedLessonId: alreadyLinkedLesson.id,
      matchedGroupId: alreadyLinkedLesson.groupId || undefined,
      matchedGroupName: linkedGroup?.name || alreadyLinkedLesson.groupName || undefined,
      matchedStudentIds: topCandidate?.evidence?.matchedStudentIds,
      confidenceScore: 100,
      matchReasons: [
        `Already linked to lesson "${alreadyLinkedLesson.title || linkedGroup?.name || alreadyLinkedLesson.groupName}" (${alreadyLinkedLesson.date})`
      ],
      evidence: topCandidate?.evidence,
      candidates,
      lastSyncedAt: new Date().toISOString()
    };
  }

  if (candidates.length === 0) {
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: effectiveShareClassification,
      matchStatus: 'unmatched',
      confidenceScore: 0,
      matchReasons: ['No scheduled lesson matched the recording date and time window.'],
      candidates: [],
      lastSyncedAt: new Date().toISOString()
    };
  }

  // Check if multiple lessons on the same date/time window have close scores
  if (
    candidates.length >= 2 &&
    candidates[1].confidenceScore >= 45 &&
    Math.abs(candidates[0].confidenceScore - candidates[1].confidenceScore) <= 12
  ) {
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: effectiveShareClassification,
      matchStatus: 'multiple_possible_lessons',
      suggestedLessonId: candidates[0].lessonId,
      matchedGroupId: candidates[0].groupId,
      matchedGroupName: candidates[0].groupName,
      matchedStudentIds: candidates[0].evidence.matchedStudentIds,
      confidenceScore: candidates[0].confidenceScore,
      matchReasons: [
        `Multiple possible lessons (${candidates.length}) overlap this date/time window. Teacher selection required.`,
        ...candidates[0].evidence.reasons
      ],
      evidence: candidates[0].evidence,
      candidates,
      lastSyncedAt: new Date().toISOString()
    };
  }

  const best = candidates[0];
  const status: GrainMatchStatus =
    best.confidenceScore >= 75
      ? 'strong_match'
      : best.confidenceScore >= 58
      ? 'suggested_match'
      : 'needs_confirmation';

  return {
    ...recording,
    durationMinutes,
    shareAccessClassification: effectiveShareClassification,
    matchStatus: status,
    suggestedLessonId: best.lessonId,
    matchedGroupId: best.groupId,
    matchedGroupName: best.groupName,
    matchedStudentIds: best.evidence.matchedStudentIds,
    confidenceScore: best.confidenceScore,
    matchReasons: best.evidence.reasons,
    evidence: best.evidence,
    candidates,
    lastSyncedAt: new Date().toISOString()
  };
}

/**
 * Incremental synchronization of Grain recordings (Section 7 & Part 8).
 * Retrieves recordings since last successful sync (or optional date filter),
 * handles pagination, deduplicates by recording ID, classifies public share access,
 * and matches against lessons using Smart Group Learning.
 */
export async function syncGrainRecordingsIncrementally(options: {
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  afterDatetime?: string;
  beforeDatetime?: string;
  titleSearch?: string;
  maxPages?: number;
}): Promise<{
  success: boolean;
  recordings: GrainDiscoveredRecording[];
  newCount: number;
  error?: string;
  errorCode?: string;
}> {
  const meta = loadGrainIntegrationMeta();
  if (!meta.enabled) {
    return {
      success: false,
      recordings: loadDiscoveredGrainRecordings(),
      newCount: 0,
      error: 'Grain integration is currently disabled in settings.',
      errorCode: 'INTEGRATION_DISABLED'
    };
  }

  const existingRecordings = loadDiscoveredGrainRecordings({ includeRemoved: true });
  const existingById = new Map<string, GrainDiscoveredRecording>();
  for (const r of existingRecordings) {
    existingById.set(r.id, r);
  }
  const removedSet = new Set(loadRemovedGrainLibraryIds());

  const filter: Record<string, string> = {};
  if (options.afterDatetime) {
    const formattedAfter = formatGrainIso8601Timestamp(options.afterDatetime);
    if (formattedAfter) filter.after_datetime = formattedAfter;
  }
  if (options.beforeDatetime) {
    const formattedBefore = formatGrainIso8601Timestamp(options.beforeDatetime);
    if (formattedBefore) filter.before_datetime = formattedBefore;
  }
  if (options.titleSearch && options.titleSearch.trim()) {
    filter.title_search = options.titleSearch.trim().slice(0, 200);
  }

  // Incremental cutoff timestamp (12h overlap before lastSuccessfulSyncAt) checked client-side on newest-first results
  const incrementalCutoffMs =
    !options.afterDatetime && !options.beforeDatetime && !options.titleSearch && meta.lastSuccessfulSyncAt
      ? Date.parse(meta.lastSuccessfulSyncAt) - 12 * 60 * 60 * 1000
      : NaN;

  const maxPages = Math.min(5, Math.max(1, options.maxPages || 3));
  let cursor: string | undefined = undefined;
  let useMinimalPayloadFallback = false;
  const fetchedRaw: any[] = [];

  for (let page = 0; page < maxPages; page++) {
    let res = await executeScopedGrainOperation({
      operation: 'list_recordings',
      payload: useMinimalPayloadFallback
        ? {
            ...(cursor ? { cursor } : {})
          }
        : {
            ...(cursor ? { cursor } : {}),
            ...(Object.keys(filter).length > 0 ? { filter } : {}),
            include: {
              participants: true,
              ai_summary: true,
              calendar_event: true
            }
          }
    });

    if (!res.ok && page === 0 && !useMinimalPayloadFallback) {
      // Fallback to documented minimal "{}" request if optional include/filter was rejected
      useMinimalPayloadFallback = true;
      res = await executeScopedGrainOperation({
        operation: 'list_recordings',
        payload: {}
      });
    }

    if (!res.ok) {
      saveGrainIntegrationMeta({
        lastError: res.errorMessage || 'Recording sync failed.',
        lastErrorCode: res.errorCode || 'SYNC_FAILED'
      });
      return {
        success: false,
        recordings: existingRecordings.filter((r) => !r.removedFromLibrary),
        newCount: 0,
        error: res.errorMessage,
        errorCode: res.errorCode
      };
    }

    const pageItems = Array.isArray(res.data?.recordings) ? res.data.recordings : [];
    fetchedRaw.push(...pageItems);

    if (Number.isFinite(incrementalCutoffMs) && pageItems.length > 0) {
      const lastItem = pageItems[pageItems.length - 1];
      const lastStartMs = Date.parse(String(lastItem?.start_datetime || ''));
      if (Number.isFinite(lastStartMs) && lastStartMs < incrementalCutoffMs) {
        break;
      }
    }

    const nextCursor = typeof res.data?.cursor === 'string' ? res.data.cursor.trim() : '';
    if (nextCursor && pageItems.length > 0) {
      cursor = nextCursor;
    } else {
      break;
    }
  }

  const activeGroups = (options.groups || []).filter((g) => g && !g.deleted);
  const learningRecords = loadGrainGroupLearningRecords(activeGroups);
  const nowIso = new Date().toISOString();

  let newCount = 0;
  for (const raw of fetchedRaw) {
    if (!raw || typeof raw !== 'object' || !raw.id) continue;
    const id = String(raw.id).trim();
    const prevRec = existingById.get(id);
    if (!prevRec) {
      newCount++;
    }

    const durationSec =
      typeof raw.duration_ms === 'number'
        ? Math.round(raw.duration_ms / 1000)
        : typeof raw.duration_seconds === 'number'
        ? raw.duration_seconds
        : typeof raw.duration === 'number'
        ? raw.duration
        : 3600;

    const rawUrlCandidate = String(raw.share_url || raw.public_url || raw.url || '').trim();
    const shareClassified = classifyGrainRecordingShareAccess({
      url: raw.url,
      public_url: raw.public_url,
      share_url: raw.share_url,
      recordingUrl: rawUrlCandidate,
      share_state: raw.share_state,
      sharing: raw.sharing,
      access_level: raw.access_level,
      visibility: raw.visibility,
      is_public: raw.is_public,
      public_access: raw.public_access
    });

    const rawZoomCandidate =
      raw.zoom_meeting_url ||
      raw.meeting_url ||
      raw.calendar_event?.meeting_url ||
      raw.calendar_event?.zoom_url ||
      raw.calendar_event?.location ||
      '';
    const verifiedZoom = normalizeZoomMeetingUrl(rawZoomCandidate);

    const participantNames = Array.isArray(raw.participants)
      ? raw.participants
          .map((p: any) => (typeof p === 'string' ? p.trim() : String(p?.name || '').trim()))
          .filter(Boolean)
      : prevRec?.participantNames;

    const aiSummaryStr = extractGrainAiSummaryText(raw.ai_summary);

    const evaluated = evaluateRecordingMatchAgainstLessons(
      {
        id,
        title: String(raw.title || 'Grain Recording').trim(),
        startDatetime: String(raw.start_datetime || raw.created_at || nowIso),
        endDatetime: typeof raw.end_datetime === 'string' ? raw.end_datetime : undefined,
        durationSeconds: durationSec,
        recordingUrl: shareClassified.validGrainPageUrl || rawUrlCandidate,
        shareAccessClassification: shareClassified.classification,
        rawShareState: shareClassified.rawShareState,
        sourcePlatform: String(raw.source || 'zoom').toLowerCase(),
        zoomMeetingUrl: verifiedZoom?.canonicalUrl,
        calendarEventTitle:
          typeof raw.calendar_event?.title === 'string' ? raw.calendar_event.title : undefined,
        participantNames,
        hasAiSummary: Boolean(aiSummaryStr),
        aiSummaryExcerpt: aiSummaryStr ? aiSummaryStr.slice(0, 400) : prevRec?.aiSummaryExcerpt,
        importedAt: prevRec?.importedAt || nowIso,
        removedFromLibrary: Boolean(prevRec?.removedFromLibrary || removedSet.has(id))
      },
      options.lessons,
      options.groups,
      options.students,
      learningRecords
    );

    existingById.set(id, evaluated);
  }

  // Re-evaluate existing cached recordings against current lessons & groups
  const mergedList = Array.from(existingById.values())
    .map((rec) => ({
      ...evaluateRecordingMatchAgainstLessons(
        rec,
        options.lessons,
        options.groups,
        options.students,
        learningRecords
      ),
      importedAt: rec.importedAt || nowIso,
      removedFromLibrary: Boolean(rec.removedFromLibrary || removedSet.has(rec.id))
    }))
    .sort((a, b) => (b.startDatetime || '').localeCompare(a.startDatetime || ''));

  saveDiscoveredGrainRecordings(mergedList);
  saveGrainIntegrationMeta({
    connected: true,
    lastSuccessfulSyncAt: nowIso,
    lastError: null,
    lastErrorCode: null
  });

  return {
    success: true,
    recordings: mergedList.filter((r) => !r.removedFromLibrary),
    newCount
  };
}

// ==========================================
// RULE 2 & RULE 5: TEACHER-CONFIRMED LESSON LINKING & ATTENDANCE IMMUTABILITY
// ==========================================

/**
 * Verifies that two lesson states have identical attendance records (Rule 2).
 * Throws an error if Grain linking or metadata updates attempt to alter attendance.
 */
export function assertLessonAttendanceUnchanged(beforeLesson: Lesson, afterUpdate: Partial<Lesson>): void {
  if ('attendance' in afterUpdate && JSON.stringify(afterUpdate.attendance) !== JSON.stringify(beforeLesson.attendance)) {
    throw new Error('RULE_2_VIOLATION: Grain integration is strictly forbidden from modifying lesson.attendance.');
  }
  if (afterUpdate.report) {
    const beforeAttStatus = beforeLesson.report?.attendanceStatus;
    const afterAttStatus = afterUpdate.report.attendanceStatus;
    if (afterAttStatus !== undefined && afterAttStatus !== beforeAttStatus) {
      throw new Error('RULE_2_VIOLATION: Grain integration is strictly forbidden from modifying report.attendanceStatus.');
    }
    const beforeMap = JSON.stringify(beforeLesson.report?.studentAttendance || {});
    const afterMap = JSON.stringify(afterUpdate.report.studentAttendance || {});
    if (afterUpdate.report.studentAttendance !== undefined && beforeMap !== afterMap) {
      throw new Error('RULE_2_VIOLATION: Grain integration is strictly forbidden from modifying report.studentAttendance.');
    }
  }
}

export interface ConfirmGrainMatchResult {
  requiresOverwriteConfirmation: boolean;
  existingUrlInTargetSlot?: string;
  targetSlot: 'recordingLink' | 'recordingLink2';
  proposedLessonPatch: Partial<Lesson>;
}

/**
 * Prepares a teacher-confirmed recording link attachment for a specific Glück lesson.
 * Rule 2: Never modifies attendance.
 * Rule 5: Returns a proposed patch; requires explicit teacher confirmation if overwriting an existing link.
 * Part 2: Preserves `shareAccessClassification` on `lesson.grainMeta`.
 */
export function prepareConfirmedGrainLessonAttachment(options: {
  lesson: Lesson;
  recording: GrainDiscoveredRecording;
  preferredSlot?: 'auto' | 'recordingLink' | 'recordingLink2';
  allowOverwrite?: boolean;
}): ConfirmGrainMatchResult {
  const { lesson, recording, preferredSlot = 'auto', allowOverwrite = false } = options;
  const currentR1 = (lesson.recordingLink || lesson.report?.recordingLink || '').trim();
  const currentR2 = (lesson.recordingLink2 || lesson.report?.recordingLink2 || '').trim();
  const newUrl = recording.recordingUrl.trim();

  let targetSlot: 'recordingLink' | 'recordingLink2' = 'recordingLink';
  if (preferredSlot === 'recordingLink2') {
    targetSlot = 'recordingLink2';
  } else if (preferredSlot === 'recordingLink') {
    targetSlot = 'recordingLink';
  } else {
    if (!currentR1 || currentR1 === newUrl) {
      targetSlot = 'recordingLink';
    } else if (!currentR2 || currentR2 === newUrl) {
      targetSlot = 'recordingLink2';
    } else {
      targetSlot = 'recordingLink';
    }
  }

  const existingUrlInSlot = targetSlot === 'recordingLink' ? currentR1 : currentR2;
  const hasConflict = Boolean(existingUrlInSlot && existingUrlInSlot !== newUrl);

  const shareClass: GrainShareAccessClassification =
    recording.shareAccessClassification ||
    classifyGrainRecordingShareAccess({
      recordingUrl: newUrl,
      share_state: recording.rawShareState
    }).classification;

  const nextGrainMeta: GrainLessonMetadata = {
    ...(lesson.grainMeta || {
      recordingId: recording.id,
      recordingTitle: recording.title,
      startTimestamp: recording.startDatetime,
      endTimestamp: recording.endDatetime,
      durationMinutes: recording.durationMinutes,
      recordingUrl: newUrl,
      shareAccessClassification: shareClass,
      groupId: lesson.groupId || undefined,
      source: recording.sourcePlatform || 'zoom',
      matchingStatus: 'confirmed',
      confirmedLessonId: lesson.id,
      lastSyncedAt: new Date().toISOString()
    }),
    ...(targetSlot === 'recordingLink'
      ? {
          recordingId: recording.id,
          recordingTitle: recording.title,
          startTimestamp: recording.startDatetime,
          endTimestamp: recording.endDatetime,
          durationMinutes: recording.durationMinutes,
          recordingUrl: newUrl,
          shareAccessClassification: shareClass
        }
      : {
          recordingIdPart2: recording.id,
          recordingTitlePart2: recording.title,
          recordingUrlPart2: newUrl,
          shareAccessClassificationPart2: shareClass
        }),
    groupId: lesson.groupId || lesson.grainMeta?.groupId,
    matchingStatus: 'confirmed',
    confirmedLessonId: lesson.id,
    lastSyncedAt: new Date().toISOString(),
    supplementaryParticipantsObserved: recording.participantNames
      ? recording.participantNames.slice(0, 25)
      : lesson.grainMeta?.supplementaryParticipantsObserved
  };

  const nextR1 = targetSlot === 'recordingLink' ? newUrl : currentR1 || undefined;
  const nextR2 = targetSlot === 'recordingLink2' ? newUrl : currentR2 || undefined;

  const proposedLessonPatch: Partial<Lesson> = {
    recordingLink: nextR1,
    recordingLink2: nextR2,
    grainMeta: nextGrainMeta,
    ...(lesson.report
      ? {
          report: {
            ...lesson.report,
            recordingLink: nextR1,
            recordingLink2: nextR2,
            grainMeta: nextGrainMeta
          }
        }
      : {})
  };

  // Enforce Rule 2 before returning
  assertLessonAttendanceUnchanged(lesson, proposedLessonPatch);

  return {
    requiresOverwriteConfirmation: hasConflict && !allowOverwrite,
    existingUrlInTargetSlot: hasConflict ? existingUrlInSlot : undefined,
    targetSlot,
    proposedLessonPatch
  };
}

// ==========================================
// SECTION 10 & RULE 3: EDUCATIONAL SUMMARIES & EPHEMERAL TRANSCRIPT ANALYSIS
// ==========================================

function parseGrainTranscriptPayload(raw: any): {
  utterances: Array<{ speaker: string; text: string; startMs?: number; endMs?: number }>;
  plainText: string;
} {
  if (!raw) return { utterances: [], plainText: '' };
  if (typeof raw === 'string') {
    return { utterances: [], plainText: raw.trim() };
  }
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.transcript)
    ? raw.transcript
    : Array.isArray(raw.utterances)
    ? raw.utterances
    : Array.isArray(raw.segments)
    ? raw.segments
    : [];

  const utterances: Array<{ speaker: string; text: string; startMs?: number; endMs?: number }> = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const text = String(item.text || item.transcript || item.content || '').trim();
    if (!text) continue;
    const speaker = String(item.speaker || item.speaker_name || item.participant?.name || 'Speaker').trim();
    utterances.push({
      speaker,
      text,
      startMs: typeof item.start_ms === 'number' ? item.start_ms : typeof item.start === 'number' ? item.start * 1000 : undefined,
      endMs: typeof item.end_ms === 'number' ? item.end_ms : typeof item.end === 'number' ? item.end * 1000 : undefined
    });
  }

  const plainText =
    utterances.length > 0
      ? utterances.map((u) => `${u.speaker}: ${u.text}`).join('\n')
      : typeof raw.rawText === 'string'
      ? raw.rawText.trim()
      : '';

  return { utterances, plainText };
}

export async function getTranscriptEphemerally(recordingId: string): Promise<{
  available: boolean;
  plainText: string;
  errorCode?: string;
}> {
  const now = Date.now();
  // Purge expired entries
  for (const [k, v] of ephemeralTranscriptCache.entries()) {
    if (now >= v.expiresAtMs) ephemeralTranscriptCache.delete(k);
  }

  const cached = ephemeralTranscriptCache.get(recordingId);
  if (cached && now < cached.expiresAtMs) {
    return { available: true, plainText: cached.plainText };
  }

  const res = await executeScopedGrainOperation({
    operation: 'recording_transcript',
    recordingId
  });

  if (!res.ok || !res.data) {
    return {
      available: false,
      plainText: '',
      errorCode: res.errorCode || 'TRANSCRIPT_RESTRICTED'
    };
  }

  const parsed = parseGrainTranscriptPayload(res.data);
  if (!parsed.plainText) {
    return { available: false, plainText: '', errorCode: 'EMPTY_TRANSCRIPT' };
  }

  // Enforce max cache size (LRU eviction)
  if (ephemeralTranscriptCache.size >= TRANSCRIPT_CACHE_MAX_ENTRIES) {
    const oldestKey = ephemeralTranscriptCache.keys().next().value;
    if (oldestKey) ephemeralTranscriptCache.delete(oldestKey);
  }

  ephemeralTranscriptCache.set(recordingId, {
    recordingId,
    fetchedAtMs: now,
    expiresAtMs: now + TRANSCRIPT_CACHE_TTL_MS,
    utterances: parsed.utterances,
    plainText: parsed.plainText
  });

  return { available: true, plainText: parsed.plainText };
}

const KNOWN_GERMAN_GRAMMAR_TOPICS: Array<{
  pattern: RegExp;
  topic: string;
  explanationAr: string;
  explanationDe: string;
  difficultySuggestion: string;
}> = [
  {
    pattern: /\b(akkusativ|den\s+\w+|einen\s+\w+)\b/i,
    topic: 'Akkusativ (المفعول به في الألمانية)',
    explanationAr: 'تحويل أداة التعريف المذكرة der إلى den والنكرة ein إلى einen بعد أفعال المفعول به.',
    explanationDe: 'Bestimmter und unbestimmter Artikel im Akkusativ (der → den, ein → einen).',
    difficultySuggestion: 'مقترح للمراجعة: التمييز بين الفعل المتعدي (يحتاج Akkusativ) وفعل الكينونة (sein → Nominativ).'
  },
  {
    pattern: /\b(dativ|dem\s+\w+|einem\s+\w+|mit\s+dem|mit\s+der)\b/i,
    topic: 'Dativ (حالة الجر والمفعول غير المباشر)',
    explanationAr: 'استخدام حالة Dativ مع حروف الجر (mit, nach, عند, zu, von) وتغير الأدوات (der/das → dem, die → der).',
    explanationDe: 'Artikel und Präpositionen mit dem Dativ (dem, der, den + n).',
    difficultySuggestion: 'مقترح للمراجعة: إضافة حرف -n لجمع الأسماء في حالة Dativ.'
  },
  {
    pattern: /\b(trennbar\w*\s+verb\w*|aufstehen|einkaufen|anrufen|fernsehen|mitkommen)\b/i,
    topic: 'Trennbare Verben (الأفعال المنفصلة)',
    explanationAr: 'انفصال المقطع الأمامي للفعل ووضعه في نهاية الجملة الخبرية أو السؤال.',
    explanationDe: 'Trennbare Präfixe stehen im Hauptsatz am Satzende.',
    difficultySuggestion: 'مقترح للمراجعة: تذكّر وضع المقطع المنفصل في آخر الجملة وعدم نسيانه.'
  },
  {
    pattern: /\b(modalverb\w*|können|müssen|wollen|sollen|dürfen|möchten)\b/i,
    topic: 'Modalverben (الأفعال الناقصة)',
    explanationAr: 'تصريف الفعل الناقص في الموقع الثاني ووضع الفعل الأصلي في المصدر (Infinitiv) في نهاية الجملة.',
    explanationDe: 'Modalverb auf Position 2, Vollverb im Infinitiv am Satzende.',
    difficultySuggestion: 'مقترح للمراجعة: تغير الحرف المتحرك مع الضمائر المفردة (ich/er/sie/es).'
  },
  {
    pattern: /\b(perfekt|ge\w+t|ge\w+en|haben\s+.*\s+ge|sein\s+.*\s+ge)\b/i,
    topic: 'Das Perfekt (الماضي التام)',
    explanationAr: 'تكوين صيغة الماضي التام باستخدام الفعل المساعد haben أو sein في الموقع الثاني والتصريف الثالث (Partizip II) في آخر الجملة.',
    explanationDe: 'Perfekt mit Hilfsverb (haben/sein) und Partizip II am Satzende.',
    difficultySuggestion: 'مقترح للمراجعة: اختيار sein مع أفعال الحركة وتغير الحالة، و haben مع بقية الأفعال.'
  },
  {
    pattern: /\b(wechselpräposition\w*|in\s+dem|im\s+|auf\s+den|an\s+der)\b/i,
    topic: 'Wechselpräpositionen (حروف الجر المشتركة)',
    explanationAr: 'استخدام Dativ عند السكون (Wo?) واستخدام Akkusativ عند الحركة والاتجاه (Wohin?).',
    explanationDe: 'Wo? → Dativ (Position) | Wohin? → Akkusativ (Richtung).',
    difficultySuggestion: 'مقترح للمراجعة: التفريق بين السؤال بـ Wo والسؤال بـ Wohin.'
  }
];

/**
 * Generates a structured, cautious educational draft from Grain recording details,
 * AI summary (when available), and ephemeral transcript (when available).
 * Strictly enforces Section 10 & Rule 3:
 * - Never invents unsupported vocabulary.
 * - Labels learner difficulties and follow-ups as suggestions requiring teacher review.
 * - Distinguishes explicitly stated homework from AI suggestions.
 * - Never retains raw transcripts in shared models.
 */
export async function generateEducationalDraftForRecording(
  recording: GrainDiscoveredRecording,
  options?: {
    lesson?: Lesson;
    students?: Student[];
    includeTranscriptAnalysis?: boolean;
  }
): Promise<{
  success: boolean;
  draft?: GrainEducationalDraft;
  error?: string;
  errorCode?: string;
}> {
  // 1. Fetch detailed recording object from Grain using documented v2 include schema
  const detailRes = await executeScopedGrainOperation({
    operation: 'recording_details',
    recordingId: recording.id,
    payload: {
      include: {
        participants: true,
        ai_summary: true,
        ai_template_sections: { format: 'json' },
        calendar_event: true
      }
    }
  });

  const detailData = detailRes.ok ? detailRes.data : null;
  const extractedDetailSummary = extractGrainAiSummaryText(detailData?.ai_summary);
  const rawAiSummary = extractedDetailSummary || recording.aiSummaryExcerpt || '';

  const templateSections: Array<{ title: string; content: string }> = [];
  if (Array.isArray(detailData?.ai_template_sections)) {
    for (const sec of detailData.ai_template_sections) {
      if (sec && typeof sec === 'object') {
        const t = String(sec.title || sec.name || '').trim();
        const c = String(sec.content || sec.text || sec.body || '').trim();
        if (t && c) templateSections.push({ title: t, content: c });
      }
    }
  }

  // 2. Optionally fetch transcript ephemerally if requested and supported
  let transcriptText = '';
  if (options?.includeTranscriptAnalysis !== false) {
    const tr = await getTranscriptEphemerally(recording.id);
    if (tr.available) {
      transcriptText = tr.plainText;
    }
  }

  const combinedCorpus = [
    recording.title,
    rawAiSummary,
    ...templateSections.map((s) => `${s.title}: ${s.content}`),
    transcriptText
  ]
    .filter(Boolean)
    .join('\n');

  const sourceType: GrainEducationalDraft['source'] = rawAiSummary
    ? 'grain_ai_summary'
    : transcriptText
    ? 'transcript_analysis'
    : 'recording_metadata';

  // Extract German nouns with articles (der/die/das + Capitalized German Noun) authentically present in the text
  const vocabMap = new Map<string, GrainVocabularySuggestion>();
  const articleNounRegex = /\b(der|die|das)\s+([A-ZÄÖÜ][a-zäöüß]{2,22})\b/g;
  let match: RegExpExecArray | null;
  while ((match = articleNounRegex.exec(combinedCorpus)) !== null) {
    const art = match[1].toLowerCase() as 'der' | 'die' | 'das';
    const noun = match[2];
    const key = `${art} ${noun}`;
    if (!vocabMap.has(key) && vocabMap.size < 12) {
      // Find surrounding sentence as example if available
      const sentenceMatch = new RegExp(`[^.!?\n]*\\b${art}\\s+${noun}\\b[^.!?\n]*[.!?]?`, 'i').exec(combinedCorpus);
      vocabMap.set(key, {
        german: noun,
        article: art,
        arabic: '', // Left for teacher confirmation if not explicitly translated in text
        exampleSentence: sentenceMatch ? sentenceMatch[0].trim().slice(0, 140) : undefined,
        source: sourceType,
        confidence: rawAiSummary ? 'high' : 'suggestion'
      });
    }
  }

  // Detect authentic German grammar topics covered in the text
  const grammarSuggestions: GrainGrammarSuggestion[] = [];
  for (const gRule of KNOWN_GERMAN_GRAMMAR_TOPICS) {
    if (gRule.pattern.test(combinedCorpus)) {
      grammarSuggestions.push({
        topic: gRule.topic,
        explanationAr: gRule.explanationAr,
        explanationDe: gRule.explanationDe,
        examples: [],
        possibleLearnerDifficulties: [gRule.difficultySuggestion],
        source: sourceType,
        status: 'teacher_review_required'
      });
    }
  }

  // Extract explicitly stated homework vs suggested practice
  const homeworkSuggestions: GrainHomeworkSuggestion[] = [];
  const explicitHwRegex = /([^\n.]*\b(?:hausaufgabe\w*|homework|واجب|حل صفحة|übung|seite\s+\d+)\b[^\n.]*)/gi;
  const hwMatches = combinedCorpus.match(explicitHwRegex) || [];
  if (hwMatches.length > 0) {
    const cleanHw = hwMatches[0].trim().slice(0, 200);
    homeworkSuggestions.push({
      title: 'واجب مذكور في الحصة (يرجى مراجعة المعلم)',
      description: cleanHw,
      assignmentKind: 'explicitly_assigned_in_lesson',
      source: rawAiSummary ? 'grain_ai_summary' : 'transcript_analysis',
      status: 'teacher_review_required'
    });
  } else if (grammarSuggestions.length > 0 || vocabMap.size > 0) {
    homeworkSuggestions.push({
      title: 'مقترح تدريب إضافي (اقتراح آلي للمراجعة)',
      description: `مراجعة المفردات والقواعد التي نوقشت في حصة "${recording.title}".`,
      assignmentKind: 'ai_suggested_practice',
      source: rawAiSummary ? 'grain_ai_summary' : 'transcript_analysis',
      status: 'teacher_review_required'
    });
  }

  const conciseSummaryAr = rawAiSummary
    ? `ملخص مقترح من Grain (يتطلب مراجعة المعلم): ${rawAiSummary.slice(0, 360)}`
    : grammarSuggestions.length > 0
    ? `تمت مناقشة موضوع "${recording.title}" مع التركيز على: ${grammarSuggestions.map((g) => g.topic).join('، ')}.`
    : `حصة مسجلة بعنوان "${recording.title}" (${recording.durationMinutes} دقيقة).`;

  const conciseSummaryEn = rawAiSummary
    ? `Suggested Grain summary (teacher review required): ${rawAiSummary.slice(0, 360)}`
    : `Recorded session "${recording.title}" (${recording.durationMinutes} min).`;

  const conciseSummaryDe = rawAiSummary
    ? `Vorgeschlagene Grain-Zusammenfassung (Lehrkraft-Prüfung erforderlich): ${rawAiSummary.slice(0, 360)}`
    : `Aufgezeichnete Unterrichtsstunde „${recording.title}“ (${recording.durationMinutes} Min.).`;

  // Cautious student-specific revision suggestions (never inferring grades, attendance, or mastery!)
  const studentFollowUps: Record<string, GrainStudentFollowUpSuggestion> = {};
  if (options?.students && options.students.length > 0) {
    const revTopic = grammarSuggestions[0]?.topic || recording.title;
    for (const st of options.students) {
      studentFollowUps[st.id] = {
        studentId: st.id,
        cautiousObservationAr: `موضوع مقترح للمراجعة والمتابعة من الحصة: ${revTopic} (مسودة للمعلم فقط).`,
        cautiousObservationEn: `Suggested follow-up & revision topic from session: ${revTopic} (Teacher draft).`,
        cautiousObservationDe: `Vorgeschlagenes Wiederholungsthema aus der Stunde: ${revTopic} (Entwurf für Lehrkraft).`,
        suggestedRevisionTopic: revTopic,
        source: rawAiSummary ? 'grain_ai_summary' : 'transcript_analysis',
        status: 'teacher_review_required'
      };
    }
  }

  const draft: GrainEducationalDraft = {
    recordingId: recording.id,
    generatedAt: new Date().toISOString(),
    source: sourceType,
    status: 'teacher_review_required',
    whatWasCoveredAr: conciseSummaryAr,
    whatWasCoveredEn: conciseSummaryEn,
    whatWasCoveredDe: conciseSummaryDe,
    mainLearningObjectives:
      grammarSuggestions.length > 0
        ? grammarSuggestions.map((g) => g.topic)
        : [recording.title],
    importantExamples: Array.from(vocabMap.values())
      .map((v) => v.exampleSentence)
      .filter((s): s is string => Boolean(s))
      .slice(0, 5),
    topicsNeedingRevision: grammarSuggestions.map((g) => `${g.topic} (مقترح مراجعة)`),
    vocabulary: Array.from(vocabMap.values()),
    grammar: grammarSuggestions,
    homework: homeworkSuggestions,
    studentFollowUps
  };

  return {
    success: true,
    draft
  };
}

// ==========================================
// RULE 4 & PART 11: PARENT REPORT PRIVACY, PUBLIC LINKS & MULTI-LESSON SELECTION
// ==========================================

/**
 * Part 11.2: Sorts lessons strictly Newest first → Oldest last by actual lesson date and start time
 * (never relying on array insertion order).
 */
export function sortLessonsNewestFirst(lessons: Lesson[]): Lesson[] {
  return [...(lessons || [])].sort((a, b) => {
    const dtA = parseLessonDateTimeMinutes(a?.date || '', a?.time || '00:00');
    const dtB = parseLessonDateTimeMinutes(b?.date || '', b?.time || '00:00');
    if (dtA.valid && dtB.valid && dtA.epochMsLocal !== dtB.epochMsLocal) {
      return dtB.epochMsLocal - dtA.epochMsLocal;
    }
    const dateCmp = String(b?.date || '').localeCompare(String(a?.date || ''));
    if (dateCmp !== 0) return dateCmp;
    return String(b?.time || '').localeCompare(String(a?.time || ''));
  });
}

/**
 * Sanitizes a Grain-derived summary for a specific student's parent report:
 * - Removes raw transcript lines (e.g. "Speaker: ...").
 * - Removes internal AI status tags.
 * - Redacts names and private details of all OTHER students in the group!
 */
export function sanitizeGrainSummaryForParentReport(options: {
  rawSummaryText: string;
  targetStudent?: Student | null;
  allGroupStudents?: Student[];
  language?: 'ar' | 'en' | 'de';
}): string {
  let clean = redactGrainSecrets(options.rawSummaryText || '').trim();
  if (!clean) return '';

  // Strip internal prefix labels if present
  clean = clean
    .replace(/^ملخص مقترح من Grain \(يتطلب مراجعة المعلم\):\s*/i, '')
    .replace(/^Suggested Grain summary \(teacher review required\):\s*/i, '')
    .replace(/^Vorgeschlagene Grain-Zusammenfassung \(Lehrkraft-Prüfung erforderlich\):\s*/i, '');

  // Strip any raw speaker-attributed transcript lines ("Speaker Name: ...")
  clean = clean
    .split('\n')
    .filter((line) => !/^[A-Za-zÄÖÜäöüß\u0600-\u06FF\s]{2,25}:\s+/.test(line.trim()))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Redact names of other group students so Student A's parent never sees Student B's name (Rule 4)
  const targetId = options.targetStudent?.id;
  const otherStudents = (options.allGroupStudents || []).filter((s) => s && s.id !== targetId);
  for (const other of otherStudents) {
    const namesToRedact = [
      other.name,
      other.nameAr,
      other.nameEn,
      other.displayNameAr,
      other.displayNameEn,
      other.certificateName
    ]
      .map((n) => String(n || '').trim())
      .filter((n) => n.length >= 3);

    for (const otherName of namesToRedact) {
      const escaped = otherName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      clean = clean.replace(
        regex,
        options.language === 'ar' ? 'أحد الطلاب' : options.language === 'de' ? 'ein Mitschüler' : 'a classmate'
      );
    }
  }

  return clean.slice(0, 450);
}

export interface MultiLessonParentReportEntry {
  lessonId: string;
  date: string;
  time: string;
  topic: string;
  approvedSummary?: string;
  homework?: string;
  verifiedPublicRecordingUrl?: string;
  verifiedPublicRecordingUrl2?: string;
  excludedNonPublicRecordingStatus?: GrainShareAccessClassification;
}

/**
 * Part 2 (FIX-1) & Part 11.5: Builds a structured, privacy-safe multi-lesson parent report section.
 * - Orders selected lessons clearly (newest-first or chronological).
 * - Includes ONLY verified public Grain recording links (`public_access_verified`) or non-Zoom external links.
 * - Never includes Zoom meeting URLs, Grain API endpoints, transcript URLs, or unverified/workspace/private Grain links.
 * - Collects warnings for any lesson whose Grain recording link is not verified as public (`workspace_only`, `restricted`, `unknown`).
 */
export function buildMultiLessonParentReportData(options: {
  selectedLessons?: Lesson[];
  lessons?: Lesson[];
  targetStudent?: Student | null;
  allGroupStudents?: Student[];
  discoveredRecordings?: GrainDiscoveredRecording[];
  language?: 'ar' | 'en' | 'de';
}): {
  entries: MultiLessonParentReportEntry[];
  nonPublicWarnings: Array<{ lessonId: string; lessonDate: string; lessonTitle: string; classification: GrainShareAccessClassification }>;
  excludedNonPublicCount: number;
  formattedText: string;
  formattedReportText: string;
} {
  const lang = options.language || 'ar';
  const inputLessons = options.selectedLessons || options.lessons || [];
  const ordered = sortLessonsNewestFirst(inputLessons);
  const discovered = options.discoveredRecordings || loadDiscoveredGrainRecordings({ includeRemoved: true });

  const entries: MultiLessonParentReportEntry[] = [];
  const nonPublicWarnings: Array<{ lessonId: string; lessonDate: string; lessonTitle: string; classification: GrainShareAccessClassification }> = [];

  for (const lesson of ordered) {
    if (!lesson) continue;
    const topic = String(
      lesson.report?.arabicTopicsExplained ||
        lesson.whatWasTaught ||
        lesson.topic ||
        lesson.title ||
        lesson.groupName ||
        ''
    ).trim();

    const rawApprovedSummary =
      lang === 'ar'
        ? lesson.grainMeta?.approvedParentReportSummaryAr ||
          lesson.report?.grainMeta?.approvedParentReportSummaryAr ||
          lesson.grainMeta?.approvedSummary ||
          ''
        : lang === 'de'
        ? lesson.grainMeta?.approvedParentReportSummaryDe ||
          lesson.report?.grainMeta?.approvedParentReportSummaryDe ||
          lesson.grainMeta?.approvedSummaryDe ||
          lesson.grainMeta?.approvedSummary ||
          ''
        : lesson.grainMeta?.approvedParentReportSummaryEn ||
          lesson.report?.grainMeta?.approvedParentReportSummaryEn ||
          lesson.grainMeta?.approvedSummaryEn ||
          lesson.grainMeta?.approvedSummary ||
          '';

    const approvedSummary = rawApprovedSummary
      ? sanitizeGrainSummaryForParentReport({
          rawSummaryText: rawApprovedSummary,
          targetStudent: options.targetStudent,
          allGroupStudents: options.allGroupStudents,
          language: lang
        })
      : undefined;

    const homework = String(
      lesson.report?.arabicHomeworkRequired ||
        lesson.report?.homeworkTitle ||
        lesson.homeworkTitle ||
        lesson.grainMeta?.approvedHomeworkSuggestion ||
        ''
    ).trim() || undefined;

    const rawLink1 = (lesson.recordingLink || lesson.report?.recordingLink || lesson.grainMeta?.recordingUrl || '').trim();
    const rawLink2 = (lesson.recordingLink2 || lesson.report?.recordingLink2 || lesson.grainMeta?.recordingUrlPart2 || '').trim();

    let verifiedUrl1: string | undefined;
    let verifiedUrl2: string | undefined;
    let excludedStatus: GrainShareAccessClassification | undefined;

    if (rawLink1) {
      if (normalizeZoomMeetingUrl(rawLink1)) {
        excludedStatus = 'link_unavailable';
        nonPublicWarnings.push({
          lessonId: lesson.id,
          lessonDate: lesson.date,
          lessonTitle: lesson.title || lesson.groupName,
          classification: 'link_unavailable'
        });
      } else if (isGrainRecordingUrl(rawLink1)) {
        const cls1 = getLessonRecordingShareClassification(lesson, 'recordingLink', discovered);
        if (isParentReadyPublicGrainLink(rawLink1, cls1)) {
          verifiedUrl1 = rawLink1;
        } else {
          excludedStatus = cls1;
          nonPublicWarnings.push({
            lessonId: lesson.id,
            lessonDate: lesson.date,
            lessonTitle: lesson.title || lesson.groupName,
            classification: cls1
          });
        }
      } else if (!/\/_\/public-api\/|\/transcript(\/|$)|\.(mp4|webm)(\?|$)/i.test(rawLink1)) {
        verifiedUrl1 = rawLink1;
      }
    }

    if (rawLink2 && !normalizeZoomMeetingUrl(rawLink2)) {
      if (isGrainRecordingUrl(rawLink2)) {
        const cls2 = getLessonRecordingShareClassification(lesson, 'recordingLink2', discovered);
        if (isParentReadyPublicGrainLink(rawLink2, cls2)) {
          verifiedUrl2 = rawLink2;
        } else if (!excludedStatus) {
          excludedStatus = cls2;
        }
      } else if (!/\/_\/public-api\/|\/transcript(\/|$)|\.(mp4|webm)(\?|$)/i.test(rawLink2)) {
        verifiedUrl2 = rawLink2;
      }
    }

    entries.push({
      lessonId: lesson.id,
      date: lesson.date,
      time: lesson.time,
      topic,
      approvedSummary,
      homework,
      verifiedPublicRecordingUrl: verifiedUrl1,
      verifiedPublicRecordingUrl2: verifiedUrl2,
      excludedNonPublicRecordingStatus: excludedStatus
    });
  }

  const lines: string[] = [];
  if (entries.length > 0) {
    if (lang === 'ar') {
      lines.push(`📚 سجل الحصص المختارة (${entries.length}):`);
      entries.forEach((e, idx) => {
        lines.push(`${idx + 1}. 📅 ${e.date}${e.time ? ` (${e.time})` : ''} — ${e.topic || 'حصة دراسية'}`);
        if (e.approvedSummary) {
          lines.push(`   • ملخص الحصة: ${e.approvedSummary}`);
        }
        if (e.homework) {
          lines.push(`   • الواجب: ${e.homework}`);
        }
        if (e.verifiedPublicRecordingUrl) {
          lines.push(`   • 🎥 رابط تسجيل الحصة: ${e.verifiedPublicRecordingUrl}`);
        }
        if (e.verifiedPublicRecordingUrl2) {
          lines.push(`   • 🎥 رابط التسجيل (الجزء 2): ${e.verifiedPublicRecordingUrl2}`);
        }
      });
    } else if (lang === 'de') {
      lines.push(`📚 Ausgewählte Unterrichtsstunden (${entries.length}):`);
      entries.forEach((e, idx) => {
        lines.push(`${idx + 1}. 📅 ${e.date}${e.time ? ` (${e.time})` : ''} — ${e.topic || 'Unterrichtsstunde'}`);
        if (e.approvedSummary) {
          lines.push(`   • Zusammenfassung: ${e.approvedSummary}`);
        }
        if (e.homework) {
          lines.push(`   • Hausaufgabe: ${e.homework}`);
        }
        if (e.verifiedPublicRecordingUrl) {
          lines.push(`   • 🎥 Aufzeichnungslink: ${e.verifiedPublicRecordingUrl}`);
        }
        if (e.verifiedPublicRecordingUrl2) {
          lines.push(`   • 🎥 Aufzeichnungslink (Teil 2): ${e.verifiedPublicRecordingUrl2}`);
        }
      });
    } else {
      lines.push(`📚 Selected Lessons Summary (${entries.length}):`);
      entries.forEach((e, idx) => {
        lines.push(`${idx + 1}. 📅 ${e.date}${e.time ? ` (${e.time})` : ''} — ${e.topic || 'Lesson'}`);
        if (e.approvedSummary) {
          lines.push(`   • Summary: ${e.approvedSummary}`);
        }
        if (e.homework) {
          lines.push(`   • Homework: ${e.homework}`);
        }
        if (e.verifiedPublicRecordingUrl) {
          lines.push(`   • 🎥 Recording Link: ${e.verifiedPublicRecordingUrl}`);
        }
        if (e.verifiedPublicRecordingUrl2) {
          lines.push(`   • 🎥 Recording Link (Part 2): ${e.verifiedPublicRecordingUrl2}`);
        }
      });
    }
  }

  const formattedText = lines.join('\n');
  return {
    entries,
    nonPublicWarnings,
    excludedNonPublicCount: nonPublicWarnings.length,
    formattedText,
    formattedReportText: formattedText
  };
}

// ==========================================
// SECTION 12: LERNSTUDIO DRAFT GENERATOR (REQUIRES TEACHER APPROVAL)
// ==========================================

/**
 * Generates a reviewable LernstudioSet draft proposal from an approved GrainEducationalDraft.
 * Does NOT save or publish the set automatically — returns a draft for teacher review & editing.
 */
export function buildLernstudioDraftFromGrainEducationalDraft(
  draft: GrainEducationalDraft,
  options: {
    title?: string;
    grade?: string;
    level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
    teacherName?: string;
  } = {}
): LernstudioSet {
  const vocabItems: LernstudioItem[] = draft.vocabulary.map((v, idx) => ({
    id: `grain_voc_${idx + 1}`,
    german: v.article ? `${v.article} ${v.german}` : v.german,
    arabic: v.arabic || 'يرجى إدخال المعنى بالعربية',
    exampleSentenceGerman: v.exampleSentence || '',
    wordType: v.article ? 'noun' : 'other',
    article: v.article || undefined
  }));

  const grammarRules = draft.grammar.map((g, idx) => ({
    id: `grain_rule_${idx + 1}`,
    title: g.topic,
    titleAr: g.topic,
    titleDe: g.topic,
    summaryAr: g.explanationAr,
    summaryDe: g.explanationDe || '',
    tipAr: g.possibleLearnerDifficulties[0] || ''
  }));

  const grammarExamples = draft.importantExamples.map((ex, idx) => ({
    id: `grain_ex_${idx + 1}`,
    german: ex,
    arabic: ''
  }));

  const exercises: GrammarExercise[] = draft.grammar.map((g, idx) => ({
    id: `grain_exer_${idx + 1}`,
    type: 'short_answer',
    question: `اكتب جملة مثال على قاعدة: ${g.topic}`,
    correctAnswer: g.examples[0] || draft.importantExamples[0] || g.topic,
    acceptedAnswers: [],
    explanationAr: g.explanationAr,
    source: 'generated',
    isUncertain: true,
    uncertaintyReason: 'مقترح مستخرج من ملخص الحصة — يرجى مراجعة المعلم وتأكيد السؤال والإجابة قبل الحفظ.'
  }));

  const hasGrammar = grammarRules.length > 0;
  const setKind = hasGrammar && vocabItems.length > 0 ? 'mixed' : hasGrammar ? 'grammar' : 'vocabulary';

  return normalizeLernstudioSet({
    id: `draft_grain_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    title: options.title || `مراجعة الحصة: ${draft.mainLearningObjectives[0] || 'Deutsch'}`,
    topic: draft.mainLearningObjectives[0] || 'Wiederholung',
    level: options.level || 'A1',
    difficulty: 'medium',
    grade: options.grade as any,
    createdByTeacherName: options.teacherName,
    description: draft.whatWasCoveredAr,
    setKind,
    contentOrigin: 'teacher_created',
    published: false,
    items: vocabItems,
    ...(hasGrammar
      ? {
          grammarContent: {
            lessonTitle: options.title || draft.mainLearningObjectives[0] || 'Grammatik',
            grammarTopic: draft.grammar[0]?.topic || 'Grammatik',
            explanationAr: draft.grammar.map((g) => g.explanationAr).join('\n'),
            rules: grammarRules,
            examples: grammarExamples,
            exercises,
            origin: 'teacher_created'
          }
        }
      : {})
  });
}

// ==========================================
// RULE 3, SECTION 14 & SECTION 15: P2P, FIREBASE & BACKUP PRIVACY SANITIZER
// ==========================================

const FORBIDDEN_GRAIN_KEYS = new Set([
  'transcript',
  'rawTranscript',
  'fullTranscript',
  'utterances',
  'grainApiToken',
  'grainPersonalAccessToken',
  'grainToken',
  'grainMasterKey',
  'grainSessionToken',
  'unreviewedAiAnalysis'
]);

const VALID_SHARE_CLASSIFICATIONS = new Set<GrainShareAccessClassification>([
  'public_access_verified',
  'workspace_only',
  'restricted',
  'unknown',
  'link_unavailable'
]);

/**
 * Sanitizes a `GrainLessonMetadata` object before persisting, syncing (P2P/Firebase), or exporting to backup.
 * Ensures zero tokens, zero raw transcripts, and bounded compact strings.
 */
export function sanitizeGrainLessonMetadata(meta: any): GrainLessonMetadata | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const recordingId = String(meta.recordingId || '').trim();
  const recordingUrl = String(meta.recordingUrl || '').trim();
  if (!recordingId || !recordingUrl) return undefined;

  return {
    recordingId: redactGrainSecrets(recordingId).slice(0, 128),
    ...(meta.recordingIdPart2 ? { recordingIdPart2: redactGrainSecrets(meta.recordingIdPart2).slice(0, 128) } : {}),
    recordingTitle: redactGrainSecrets(meta.recordingTitle || 'Grain Recording').slice(0, 200),
    ...(meta.recordingTitlePart2 ? { recordingTitlePart2: redactGrainSecrets(meta.recordingTitlePart2).slice(0, 200) } : {}),
    startTimestamp: String(meta.startTimestamp || ''),
    ...(meta.endTimestamp ? { endTimestamp: String(meta.endTimestamp) } : {}),
    durationMinutes: Math.max(0, Number(meta.durationMinutes) || 0),
    recordingUrl: redactGrainSecrets(recordingUrl).slice(0, 500),
    ...(meta.recordingUrlPart2 ? { recordingUrlPart2: redactGrainSecrets(meta.recordingUrlPart2).slice(0, 500) } : {}),
    ...(VALID_SHARE_CLASSIFICATIONS.has(meta.shareAccessClassification)
      ? { shareAccessClassification: meta.shareAccessClassification }
      : {}),
    ...(VALID_SHARE_CLASSIFICATIONS.has(meta.shareAccessClassificationPart2)
      ? { shareAccessClassificationPart2: meta.shareAccessClassificationPart2 }
      : {}),
    ...(typeof meta.groupId === 'string' && meta.groupId.trim()
      ? { groupId: redactGrainSecrets(meta.groupId.trim()).slice(0, 128) }
      : {}),
    source: String(meta.source || 'zoom').slice(0, 32),
    matchingStatus: 'confirmed',
    confirmedLessonId: String(meta.confirmedLessonId || '').slice(0, 128),
    lastSyncedAt: String(meta.lastSyncedAt || new Date().toISOString()),
    ...(typeof meta.approvedSummary === 'string' && meta.approvedSummary.trim()
      ? { approvedSummary: redactGrainSecrets(meta.approvedSummary.trim()).slice(0, 500) }
      : {}),
    ...(typeof meta.approvedSummaryEn === 'string' && meta.approvedSummaryEn.trim()
      ? { approvedSummaryEn: redactGrainSecrets(meta.approvedSummaryEn.trim()).slice(0, 500) }
      : {}),
    ...(typeof meta.approvedSummaryDe === 'string' && meta.approvedSummaryDe.trim()
      ? { approvedSummaryDe: redactGrainSecrets(meta.approvedSummaryDe.trim()).slice(0, 500) }
      : {}),
    ...(Array.isArray(meta.approvedTopics)
      ? { approvedTopics: meta.approvedTopics.map((t: any) => redactGrainSecrets(t).slice(0, 120)).slice(0, 10) }
      : {}),
    ...(Array.isArray(meta.approvedVocabulary)
      ? {
          approvedVocabulary: meta.approvedVocabulary.slice(0, 20).map((v: any) => ({
            german: String(v?.german || '').slice(0, 80),
            article: typeof v?.article === 'string' ? v.article.slice(0, 10) : undefined,
            arabic: String(v?.arabic || '').slice(0, 80),
            example: typeof v?.example === 'string' ? v.example.slice(0, 160) : undefined
          }))
        }
      : {}),
    ...(Array.isArray(meta.approvedGrammarTopics)
      ? { approvedGrammarTopics: meta.approvedGrammarTopics.map((t: any) => redactGrainSecrets(t).slice(0, 120)).slice(0, 10) }
      : {}),
    ...(typeof meta.approvedHomeworkSuggestion === 'string' && meta.approvedHomeworkSuggestion.trim()
      ? { approvedHomeworkSuggestion: redactGrainSecrets(meta.approvedHomeworkSuggestion.trim()).slice(0, 300) }
      : {}),
    ...(typeof meta.approvedParentReportSummaryAr === 'string' && meta.approvedParentReportSummaryAr.trim()
      ? { approvedParentReportSummaryAr: redactGrainSecrets(meta.approvedParentReportSummaryAr.trim()).slice(0, 450) }
      : {}),
    ...(typeof meta.approvedParentReportSummaryEn === 'string' && meta.approvedParentReportSummaryEn.trim()
      ? { approvedParentReportSummaryEn: redactGrainSecrets(meta.approvedParentReportSummaryEn.trim()).slice(0, 450) }
      : {}),
    ...(typeof meta.approvedParentReportSummaryDe === 'string' && meta.approvedParentReportSummaryDe.trim()
      ? { approvedParentReportSummaryDe: redactGrainSecrets(meta.approvedParentReportSummaryDe.trim()).slice(0, 450) }
      : {}),
    ...(Array.isArray(meta.supplementaryParticipantsObserved)
      ? {
          supplementaryParticipantsObserved: meta.supplementaryParticipantsObserved
            .map((p: any) => String(p || '').trim().slice(0, 60))
            .filter(Boolean)
            .slice(0, 25)
        }
      : {})
  };
}

/**
 * Recursively strips any forbidden Grain keys (`transcript`, `rawTranscript`, `utterances`, `grain_pat_...`)
 * from any entity record before P2P sync, Firebase sync, or Backup export.
 */
export function sanitizeEntityForGrainPrivacy<T>(record: T): T {
  if (!record || typeof record !== 'object') return record;
  if (Array.isArray(record)) {
    return record.map((item) => sanitizeEntityForGrainPrivacy(item)) as unknown as T;
  }

  const clone: Record<string, any> = {};
  for (const [k, v] of Object.entries(record as Record<string, any>)) {
    if (FORBIDDEN_GRAIN_KEYS.has(k)) {
      continue;
    }
    if (k === 'grainMeta') {
      const cleanMeta = sanitizeGrainLessonMetadata(v);
      if (cleanMeta) clone.grainMeta = cleanMeta;
      continue;
    }
    if (k === 'grainGroupLearningRecords' && Array.isArray(v)) {
      clone.grainGroupLearningRecords = v
        .map((r: any) => sanitizeGrainGroupLearningRecord(r))
        .filter((r): r is GrainGroupLearningRecord => Boolean(r));
      continue;
    }
    if (typeof v === 'string') {
      clone[k] = v.includes('grain_pat_') ? redactGrainSecrets(v) : v;
    } else if (v && typeof v === 'object') {
      clone[k] = sanitizeEntityForGrainPrivacy(v);
    } else {
      clone[k] = v;
    }
  }
  return clone as T;
}

