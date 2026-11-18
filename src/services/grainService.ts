import {
  GrainCapabilityReport,
  GrainCapabilityState,
  GrainDiscoveredRecording,
  GrainEducationalDraft,
  GrainExtractedGrammarEntry,
  GrainExtractedLessonContent,
  GrainExtractedLessonContentCore,
  GrainExtractedVocabularyEntry,
  GrainGrammarSuggestion,
  GrainGroupLearningCorrectionEntry,
  GrainGroupLearningRecord,
  GrainHomeworkSuggestion,
  GrainLessonMatchCandidate,
  GrainLessonMetadata,
  GrainMatchEvidence,
  GrainMatchStatus,
  GrainPart2DetectionConfig,
  GrainShareAccessClassification,
  GrainStudentFollowUpSuggestion,
  GrainVocabularySuggestion,
  GrainWorkflowStatusBadge,
  GrainZoomLinkVerificationStatus,
  GrainMatchTier,
  GrainConfidenceLevel,
  GrainRecordingMatch,
  GroupWeeklySession,
  ZoomMeetingHistory,
  Group,
  Lesson,
  Student
} from '../types';
import {
  extractNumericZoomMeetingId,
  normalizeWeekdayIndex,
  parseStandardizedZoomTopic
} from './zoomSessionStandardizer';
import {
  loadGrainRecordingMatches,
  loadGroupWeeklySessions,
  loadZoomMeetingHistory,
  redactZoomSecrets,
  saveGrainRecordingMatches
} from './zoomService';
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
let inMemoryDiscoveredRecordingsFallback: GrainDiscoveredRecording[] = [];

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
  const removedSet = new Set(loadRemovedGrainLibraryIds());
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    const validMem = inMemoryDiscoveredRecordingsFallback
      .filter((r) => r && typeof r.id === 'string' && typeof r.recordingUrl === 'string')
      .map((r) => ({
        ...r,
        removedFromLibrary: Boolean(r.removedFromLibrary || removedSet.has(r.id))
      }));
    return options?.includeRemoved ? validMem : validMem.filter((r) => !r.removedFromLibrary);
  }
  try {
    const raw = localStorage.getItem(GRAIN_LOCAL_DISCOVERED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
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
  const trimmed = recordings.slice(0, 200).map((r) => ({
    ...r,
    aiSummaryExcerpt: r.aiSummaryExcerpt ? r.aiSummaryExcerpt.slice(0, 450) : undefined
  }));
  inMemoryDiscoveredRecordingsFallback = trimmed;
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(GRAIN_LOCAL_DISCOVERED_KEY, JSON.stringify(trimmed));
  } catch {
    // Ignore storage quota errors
  }
}

async function buildWebProxyAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Grain-Local-Client': 'glueck-web'
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
        headers: {
          'Content-Type': 'application/json',
          'X-Grain-Local-Client': 'glueck-web'
        },
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

/**
 * Normalizes a user-pasted Grain Personal Access Token:
 * - Removes invisible Unicode zero-width and RTL/LTR directional marks common on Arabic/mobile clipboards
 * - Strips optional "Authorization:" / "Bearer " prefixes and surrounding quotes
 * - Extracts embedded `grain_pat_...` token if present, or strips accidental line-wrap spaces
 */
export function normalizeGrainPersonalTokenInput(rawInput: unknown): string {
  let str = String(rawInput ?? '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/g, '')
    .trim();

  str = str.replace(/^["'`]+|["'`]+$/g, '').trim();
  str = str.replace(/^Authorization\s*:\s*/i, '').trim();
  str = str.replace(/^Bearer\s+/i, '').trim();
  str = str.replace(/^["'`]+|["'`]+$/g, '').trim();

  const patMatch = str.match(/grain_pat_[A-Za-z0-9._~+/=-]+/i);
  if (patMatch && patMatch[0]) {
    return patMatch[0];
  }

  return str.replace(/\s+/g, '');
}

export async function saveGrainPersonalToken(rawToken: string): Promise<{
  success: boolean;
  state: GrainIntegrationMetaState;
  error?: string;
  errorCode?: string;
}> {
  const cleanToken = normalizeGrainPersonalTokenInput(rawToken);
  if (!cleanToken || cleanToken.length < 6) {
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

  inMemoryDiscoveredRecordingsFallback = [];
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

export interface ExtractedGrainAiNotesBundle {
  summaryText: string;
  templateSectionLines: string[];
  highlightLines: string[];
  actionItemLines: string[];
  combinedNotesText: string;
}

/**
 * Extracts structured Grain AI Notes from a recording or recording_details response:
 * - `ai_summary`
 * - `ai_template_sections`
 * - `highlights`
 * - `ai_action_items`
 */
export function extractGrainAiNotesFromRecordingDetails(
  detailData: any,
  cachedSummaryExcerpt?: string
): ExtractedGrainAiNotesBundle {
  const rawSummary = extractGrainAiSummaryText(detailData?.ai_summary);
  const summaryText = rawSummary || String(cachedSummaryExcerpt || '').trim();

  const templateSectionLines: string[] = [];
  const rawSections = detailData?.ai_template_sections;
  const pushSection = (title: string, body: string) => {
    const cleanBody = String(body || '').trim();
    if (!cleanBody) return;
    const cleanTitle = String(title || '').trim();
    templateSectionLines.push(cleanTitle ? `${cleanTitle}: ${cleanBody}` : cleanBody);
  };

  if (Array.isArray(rawSections)) {
    for (const sec of rawSections) {
      if (typeof sec === 'string' && sec.trim()) {
        templateSectionLines.push(sec.trim());
      } else if (sec && typeof sec === 'object') {
        const title = String(sec.title || sec.name || sec.heading || '').trim();
        const rawContent =
          sec.content ?? sec.bullets ?? sec.text ?? sec.body ?? sec.summary ?? sec.items;
        if (Array.isArray(rawContent)) {
          for (const item of rawContent) {
            pushSection(title, typeof item === 'string' ? item : String(item?.text || item?.title || ''));
          }
        } else if (typeof rawContent === 'string') {
          pushSection(title, rawContent);
        }
      }
    }
  } else if (rawSections && typeof rawSections === 'object') {
    if (Array.isArray(rawSections.sections)) {
      for (const sec of rawSections.sections) {
        if (sec && typeof sec === 'object') {
          const title = String(sec.title || sec.name || sec.heading || '').trim();
          const rawContent =
            sec.content ?? sec.bullets ?? sec.text ?? sec.body ?? sec.summary ?? sec.items;
          if (Array.isArray(rawContent)) {
            for (const item of rawContent) {
              pushSection(title, typeof item === 'string' ? item : String(item?.text || item?.title || ''));
            }
          } else {
            pushSection(title, String(rawContent || ''));
          }
        }
      }
    } else {
      for (const [k, v] of Object.entries(rawSections)) {
        if (k === 'format') continue;
        if (typeof v === 'string' && v.trim()) {
          pushSection(k, v);
        } else if (Array.isArray(v)) {
          for (const item of v) {
            pushSection(k, typeof item === 'string' ? item : String((item as any)?.text || ''));
          }
        }
      }
    }
  }

  const highlightLines: string[] = [];
  if (Array.isArray(detailData?.highlights)) {
    for (const h of detailData.highlights) {
      if (typeof h === 'string' && h.trim()) {
        highlightLines.push(h.trim());
      } else if (h && typeof h === 'object') {
        const txt = String(h.text || h.quote || h.summary || h.note || h.title || '').trim();
        if (txt) highlightLines.push(txt);
      }
    }
  }

  const actionItemLines: string[] = [];
  if (Array.isArray(detailData?.ai_action_items)) {
    for (const a of detailData.ai_action_items) {
      if (typeof a === 'string' && a.trim()) {
        actionItemLines.push(a.trim());
      } else if (a && typeof a === 'object') {
        const txt = String(a.text || a.description || a.action_item || a.title || '').trim();
        if (txt) actionItemLines.push(txt);
      }
    }
  }

  const combinedParts = [
    summaryText,
    ...templateSectionLines,
    ...highlightLines.map((h) => `Highlight: ${h}`),
    ...actionItemLines.map((a) => `Offener Punkt: ${a}`)
  ]
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    summaryText,
    templateSectionLines,
    highlightLines,
    actionItemLines,
    combinedNotesText: Array.from(new Set(combinedParts)).join('\n')
  };
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
// PART 10: SMART RECURRING LESSON & GROUP LEARNING ENGINE (`GrainGroupLearningRecord`)
// ==========================================

export const DEFAULT_PART2_DETECTION_CONFIG: GrainPart2DetectionConfig = {
  expectedGapMinutes: 40,
  minGapMinutes: 32,
  maxGapMinutes: 52
};

export function normalizePart2DetectionConfig(
  raw?: Partial<GrainPart2DetectionConfig> | null
): GrainPart2DetectionConfig {
  const expected = Number(raw?.expectedGapMinutes);
  const min = Number(raw?.minGapMinutes);
  const max = Number(raw?.maxGapMinutes);
  const expectedGapMinutes = Number.isFinite(expected) && expected >= 15 && expected <= 90 ? expected : 40;
  const minGapMinutes =
    Number.isFinite(min) && min >= 10 && min <= expectedGapMinutes
      ? min
      : Math.max(20, expectedGapMinutes - 8);
  const maxGapMinutes =
    Number.isFinite(max) && max >= expectedGapMinutes && max <= 120
      ? max
      : Math.min(90, expectedGapMinutes + 12);
  return {
    expectedGapMinutes,
    minGapMinutes,
    maxGapMinutes
  };
}

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
          ...(typeof c.previousSuggestedLessonId === 'string' && c.previousSuggestedLessonId
            ? { previousSuggestedLessonId: c.previousSuggestedLessonId.slice(0, 128) }
            : {}),
          chosenGroupId: String(c.chosenGroupId).slice(0, 128),
          chosenLessonId: String(c.chosenLessonId || lessonId).slice(0, 128)
        }))
    : undefined;

  const recDayOfWeek = Number.isFinite(Number(raw.recordingDayOfWeek)) ? Number(raw.recordingDayOfWeek) : 0;
  const lessonWeekday = Number.isFinite(Number(raw.lessonWeekday)) ? Number(raw.lessonWeekday) : recDayOfWeek;
  const recStartTime = String(raw.recordingStartTime || '00:00').slice(0, 8);
  const lessonScheduledStartTime =
    typeof raw.lessonScheduledStartTime === 'string' && raw.lessonScheduledStartTime.trim()
      ? raw.lessonScheduledStartTime.trim().slice(0, 8)
      : recStartTime;

  const scheduleRecurrence =
    raw.scheduleRecurrence === 'weekly' ||
    raw.scheduleRecurrence === 'biweekly_a' ||
    raw.scheduleRecurrence === 'biweekly_b'
      ? raw.scheduleRecurrence
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
    recordingDayOfWeek: recDayOfWeek,
    lessonWeekday,
    recordingStartTime: recStartTime,
    lessonScheduledStartTime,
    recordingDuration: Math.max(1, Number(raw.recordingDuration) || 60),
    ...(Number.isFinite(Number(raw.lessonScheduledDuration)) && Number(raw.lessonScheduledDuration) > 0
      ? { lessonScheduledDuration: Math.max(15, Number(raw.lessonScheduledDuration)) }
      : {}),
    ...(scheduleRecurrence ? { scheduleRecurrence } : {}),
    normalizedTitle: redactGrainSecrets(String(raw.normalizedTitle || '')).slice(0, 160),
    participantSignatures: Array.isArray(raw.participantSignatures)
      ? raw.participantSignatures.map((p: any) => normalizeNameForComparison(String(p || '')).slice(0, 60)).filter(Boolean).slice(0, 25)
      : [],
    matchingEvidence: Array.isArray(raw.matchingEvidence)
      ? raw.matchingEvidence.map((m: any) => redactGrainSecrets(String(m || '')).slice(0, 140)).filter(Boolean).slice(0, 10)
      : [],
    teacherConfirmed: Boolean(raw.teacherConfirmed),
    confirmedAt: String(raw.confirmedAt || new Date().toISOString()),
    ...(typeof raw.updatedAt === 'string' && raw.updatedAt ? { updatedAt: String(raw.updatedAt) } : {}),
    ruleEnabled: raw.ruleEnabled !== false,
    ...(raw.part2GapToleranceMinutes
      ? { part2GapToleranceMinutes: normalizePart2DetectionConfig(raw.part2GapToleranceMinutes) }
      : {}),
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

export function setGrainLearningRuleEnabled(
  ruleId: string,
  enabled: boolean,
  activeGroups?: Group[]
): GrainGroupLearningRecord[] {
  const cleanId = String(ruleId || '').trim();
  const current = loadGrainGroupLearningRecords(activeGroups);
  const updated = current.map((r) =>
    r.id === cleanId
      ? {
          ...r,
          ruleEnabled: Boolean(enabled),
          updatedAt: new Date().toISOString()
        }
      : r
  );
  return saveGrainGroupLearningRecords(updated, activeGroups);
}

export function deleteGrainLearningRule(
  ruleId: string,
  activeGroups?: Group[]
): GrainGroupLearningRecord[] {
  const cleanId = String(ruleId || '').trim();
  const current = loadGrainGroupLearningRecords(activeGroups);
  const filtered = current.filter((r) => r.id !== cleanId);
  return saveGrainGroupLearningRecords(filtered, activeGroups);
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
 * Requirement 1 & 2 & 6: First-Time Manual Assignment = Permanent Recurring Learning.
 * Records a teacher-confirmed recording-to-lesson/group match into `GrainGroupLearningRecord`
 * keyed by stable `group.id`, recurring weekday, local scheduled start time, and student IDs.
 * - If the teacher corrects a previous suggestion or automatic match (`previousSuggestedGroupId !== lesson.groupId`),
 *   records a correction in `correctionHistory` on both the new record and any conflicting rule for the old group
 *   so the same mistake is never repeated.
 * - If the teacher confirms a lesson after a recurring schedule change, updates the learned schedule for `group.id`.
 * - Survives group name changes because `groupId` (`group.id`) is the primary identity.
 */
export function recordConfirmedGrainGroupLearning(options: {
  recording: GrainDiscoveredRecording;
  lesson: Lesson;
  groups: Group[];
  students: Student[];
  previousSuggestedGroupId?: string;
  previousSuggestedLessonId?: string;
  part2GapToleranceMinutes?: Partial<GrainPart2DetectionConfig>;
}): GrainGroupLearningRecord | null {
  const { recording, lesson, groups, students } = options;
  const groupId = String(lesson.groupId || '').trim();
  if (!groupId) return null;

  const groupObj = (groups || []).find((g) => g && !g.deleted && g.id === groupId);
  const groupExists = Boolean(groupObj);
  const groupStudents = (students || []).filter(
    (s) => s && !s.deleted && (s.groupId === groupId || (lesson.studentId && s.id === lesson.studentId))
  );
  const studentIds = groupStudents.map((s) => s.id);

  const recTime = formatLocalYmdAndTimeFromIso(recording.startDatetime);
  const dt = new Date(recording.startDatetime);
  const recDayOfWeek = !isNaN(dt.getTime()) ? dt.getDay() : 0;

  const lessonParsed = parseLessonDateTimeMinutes(lesson.date, lesson.time);
  const lessonWeekday = lessonParsed.valid
    ? new Date(
        Number(lesson.date.slice(0, 4)),
        Number(lesson.date.slice(5, 7)) - 1,
        Number(lesson.date.slice(8, 10))
      ).getDay()
    : recDayOfWeek;
  const lessonScheduledStartTime = lessonParsed.valid
    ? `${String(Math.floor(lessonParsed.minutesOfDay / 60)).padStart(2, '0')}:${String(
        lessonParsed.minutesOfDay % 60
      ).padStart(2, '0')}`
    : recTime.valid
    ? recTime.timeHm
    : lesson.time || '00:00';

  const existingRecords = loadGrainGroupLearningRecords(groups);
  const existingIdx = existingRecords.findIndex((r) => r.grainRecordingId === recording.id);
  const prevSuggestedGroupId =
    options.previousSuggestedGroupId ||
    recording.matchedGroupId ||
    recording.candidates?.[0]?.groupId ||
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
      ...(options.previousSuggestedLessonId ? { previousSuggestedLessonId: options.previousSuggestedLessonId } : {}),
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
    recordingDayOfWeek: recDayOfWeek,
    lessonWeekday,
    recordingStartTime: recTime.valid ? recTime.timeHm : lessonScheduledStartTime,
    lessonScheduledStartTime,
    recordingDuration: recording.durationMinutes || lesson.durationMinutes || 60,
    lessonScheduledDuration: Math.max(15, Number(lesson.durationMinutes || groupObj?.lessonDurationMinutes || 60)),
    scheduleRecurrence: lesson.scheduleRecurrence || groupObj?.scheduleRecurrence || 'weekly',
    normalizedTitle: normalizeNameForComparison(recording.title),
    participantSignatures: (recording.participantNames || [])
      .map(normalizeNameForComparison)
      .filter((p) => p.length >= 3)
      .slice(0, 20),
    matchingEvidence: (recording.matchReasons || []).slice(0, 8),
    teacherConfirmed: true,
    confirmedAt: nowIso,
    updatedAt: nowIso,
    ruleEnabled: true,
    part2GapToleranceMinutes: normalizePart2DetectionConfig(options.part2GapToleranceMinutes),
    ...(groupExists ? {} : { obsoleteGroup: true }),
    ...(nextCorrections.length > 0 ? { correctionHistory: nextCorrections } : {})
  };

  // Update existing records:
  // 1) If teacher confirmed a schedule change for this groupId, update older active rules for the same groupId
  //    so the new recurring schedule is learned without stale schedule-change warnings.
  // 2) If teacher corrected away from prevSuggestedGroupId at this time slot, append the correction entry
  //    to any matching rule of prevSuggestedGroupId.
  const nextList = existingRecords.map((item) => {
    if (item.grainRecordingId === recording.id) {
      return newRecord;
    }
    if (item.groupId === groupId && !item.obsoleteGroup && item.ruleEnabled !== false) {
      return {
        ...item,
        lessonWeekday,
        recordingDayOfWeek: recDayOfWeek,
        lessonScheduledStartTime,
        recordingStartTime: recTime.valid ? recTime.timeHm : lessonScheduledStartTime,
        studentIds: studentIds.length > 0 ? studentIds : item.studentIds,
        updatedAt: nowIso
      };
    }
    if (prevSuggestedGroupId && item.groupId === prevSuggestedGroupId) {
      const itemHistory = item.correctionHistory || [];
      return {
        ...item,
        correctionHistory: [
          ...itemHistory,
          {
            correctedAt: nowIso,
            previousSuggestedGroupId: prevSuggestedGroupId,
            chosenGroupId: groupId,
            chosenLessonId: lesson.id
          }
        ].slice(-15),
        updatedAt: nowIso
      };
    }
    return item;
  });

  if (existingIdx < 0) {
    nextList.unshift(newRecord);
  }

  saveGrainGroupLearningRecords(nextList, groups);
  return newRecord;
}

function parseTimeHmToMinutes(timeHm?: string | null): number | null {
  if (!timeHm || typeof timeHm !== 'string') return null;
  const parsed = parseLessonDateTimeMinutes('2026-01-01', timeHm);
  return parsed.valid ? parsed.minutesOfDay : null;
}

/**
 * Evaluates Smart Recurring Group Learning history for a candidate group (`group.id`) on a given recording and lesson.
 * - Only uses active (`teacherConfirmed && !obsoleteGroup && ruleEnabled !== false`) learning records.
 * - Compares recurring weekday + start-time window (including Part 2 offset window), recurring participant signatures, and title patterns.
 * - Detects if a group's recurring schedule has changed (`scheduleChangedRequiresConfirmation: true`) so Glück asks for confirmation once instead of silently learning an uncertain schedule change.
 * - Penalizes and blocks auto-assignment for a group if the teacher previously corrected away from it at that weekday/time slot.
 */
export function evaluateGroupLearningBoostForCandidate(options: {
  groupId: string;
  recordingDayOfWeek: number;
  recordingMinutesOfDay: number;
  recordingDurationMinutes: number;
  lessonWeekday?: number;
  lessonMinutesOfDay?: number;
  normalizedTitle: string;
  normalizedParticipants: string[];
  learningRecords: GrainGroupLearningRecord[];
  activeGroups: Group[];
}): {
  boostPoints: number;
  learnedRecurringRuleId?: string;
  scheduleChangedRequiresConfirmation: boolean;
  wasCorrectedAway: boolean;
  reasons: string[];
} {
  const {
    groupId,
    recordingDayOfWeek,
    recordingMinutesOfDay,
    recordingDurationMinutes,
    lessonWeekday = recordingDayOfWeek,
    lessonMinutesOfDay = recordingMinutesOfDay,
    normalizedTitle,
    normalizedParticipants,
    learningRecords,
    activeGroups
  } = options;

  if (!groupId) {
    return {
      boostPoints: 0,
      scheduleChangedRequiresConfirmation: false,
      wasCorrectedAway: false,
      reasons: []
    };
  }
  const isGroupActive = activeGroups.some((g) => g && !g.deleted && g.status !== 'archived' && g.id === groupId);
  if (!isGroupActive) {
    return {
      boostPoints: 0,
      scheduleChangedRequiresConfirmation: false,
      wasCorrectedAway: false,
      reasons: []
    };
  }

  let boost = 0;
  const reasons: string[] = [];
  let learnedRecurringRuleId: string | undefined;
  let scheduleChangedRequiresConfirmation = false;

  // Check correction history first: did the teacher explicitly reassign this weekday/time slot away from groupId?
  const correctedAwayRecords = learningRecords.filter((r) => {
    const rDay = r.lessonWeekday ?? r.recordingDayOfWeek;
    if (rDay !== recordingDayOfWeek && rDay !== lessonWeekday) return false;
    const learnedMin =
      parseTimeHmToMinutes(r.lessonScheduledStartTime) ??
      parseTimeHmToMinutes(r.recordingStartTime) ??
      0;
    if (Math.abs(learnedMin - recordingMinutesOfDay) > 55 && Math.abs(learnedMin - lessonMinutesOfDay) > 55) {
      return false;
    }
    return (r.correctionHistory || []).some(
      (c) => c.previousSuggestedGroupId === groupId && c.chosenGroupId !== groupId
    );
  });

  // Check if teacher later re-confirmed this group at this slot after the correction
  const confirmedForGroup = learningRecords.filter(
    (r) => r.teacherConfirmed && !r.obsoleteGroup && r.ruleEnabled !== false && r.groupId === groupId
  );

  const latestConfirmationMs = confirmedForGroup.reduce((max, r) => {
    const t = Date.parse(r.updatedAt || r.confirmedAt || '');
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);

  const latestCorrectionAwayMs = correctedAwayRecords.reduce((max, r) => {
    for (const c of r.correctionHistory || []) {
      if (c.previousSuggestedGroupId === groupId && c.chosenGroupId !== groupId) {
        const t = Date.parse(c.correctedAt || '');
        if (Number.isFinite(t) && t > max) max = t;
      }
    }
    return max;
  }, 0);

  const wasCorrectedAway =
    correctedAwayRecords.length > 0 && latestCorrectionAwayMs >= latestConfirmationMs;

  if (confirmedForGroup.length > 0 && !wasCorrectedAway) {
    // 1. Check Recurring Weekday + Start-Time slot alignment with previous teacher confirmations for this group.id
    const timeSlotMatches = confirmedForGroup.filter((r) => {
      const learnedWeekday = r.lessonWeekday ?? r.recordingDayOfWeek;
      if (learnedWeekday !== lessonWeekday && r.recordingDayOfWeek !== recordingDayOfWeek) {
        return false;
      }
      const learnedLessonMin =
        parseTimeHmToMinutes(r.lessonScheduledStartTime) ??
        parseTimeHmToMinutes(r.recordingStartTime);
      const learnedRecMin = parseTimeHmToMinutes(r.recordingStartTime) ?? learnedLessonMin;
      if (learnedLessonMin === null || learnedRecMin === null) return false;

      const part2Cfg = normalizePart2DetectionConfig(r.part2GapToleranceMinutes);
      const matchesLessonTime = Math.abs(learnedLessonMin - lessonMinutesOfDay) <= 25;
      const matchesRecPart1Time = Math.abs(learnedRecMin - recordingMinutesOfDay) <= 30;
      const recGapFromLearnedStart = recordingMinutesOfDay - learnedLessonMin;
      const matchesRecPart2Time =
        recGapFromLearnedStart >= part2Cfg.minGapMinutes &&
        recGapFromLearnedStart <= part2Cfg.maxGapMinutes;

      return matchesLessonTime && (matchesRecPart1Time || matchesRecPart2Time);
    });

    if (timeSlotMatches.length > 0) {
      learnedRecurringRuleId = timeSlotMatches[0].id;
      boost += 18;
      reasons.push(
        `Smart Recurring Rule: matches confirmed weekly slot for group (${timeSlotMatches.length} prior confirmation(s))`
      );
    } else {
      // This group has active learned recurring rules, but this lesson's weekday or start time shifted (> 25m or different weekday).
      // Requirement 2: "If a recurring schedule changes, do not silently learn the new schedule from an uncertain match. Ask for confirmation once, then update the learned rule."
      scheduleChangedRequiresConfirmation = true;
      boost += 4;
      reasons.push(
        'Recurring schedule changed from previously learned weekday/time slot — teacher confirmation required once to update rule'
      );
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
        if (
          learnedParticipants.has(p) ||
          Array.from(learnedParticipants).some((lp) => lp.includes(p) || p.includes(lp))
        ) {
          sigOverlap++;
        }
      }
      if (sigOverlap > 0) {
        boost += Math.min(8, sigOverlap * 4);
        reasons.push(
          `Smart Group Learning: ${sigOverlap} participant(s) match previously confirmed group sessions`
        );
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
        reasons.push(
          'Smart Group Learning: recording title pattern matches prior confirmed sessions for this group'
        );
      }
    }

    // 4. Duration similarity with learned group duration
    const durMatched = confirmedForGroup.some(
      (r) => Math.abs((r.recordingDuration || 60) - recordingDurationMinutes) <= 15
    );
    if (durMatched && boost > 0) {
      boost += 2;
    }
  }

  if (wasCorrectedAway) {
    boost -= Math.min(24, correctedAwayRecords.length * 14);
    learnedRecurringRuleId = undefined;
    reasons.push(
      'Smart Group Learning: teacher previously corrected and reassigned this time slot to another group'
    );
  }

  return {
    boostPoints: Math.max(-24, Math.min(26, boost)),
    learnedRecurringRuleId,
    scheduleChangedRequiresConfirmation,
    wasCorrectedAway,
    reasons
  };
}

// ==========================================
// PART 9: SMART LESSON MATCHING & AUTOMATIC RECURRING ASSIGNMENT
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
  weekday: number;
  epochMsLocal: number;
} {
  const cleanDate = String(dateStr || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return { valid: false, dateYmd: '', minutesOfDay: 0, weekday: 0, epochMsLocal: 0 };
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
    weekday: !isNaN(dt.getTime()) ? dt.getDay() : 0,
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
  utcDayOfWeek: number;
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
      utcMinutesOfDay: 0,
      utcDayOfWeek: 0
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
    utcMinutesOfDay: dt.getUTCHours() * 60 + dt.getUTCMinutes(),
    utcDayOfWeek: dt.getUTCDay()
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
 * Evaluates a single Grain recording against all candidate Glück lessons.
 * - Uses confirmed recurring group rules (`GrainGroupLearningRecord` keyed by stable `group.id`),
 *   weekday, start time, student-group relationships, duration, title, and participants.
 * - Never assigns a recording based on a student's name alone when date/time conflicts.
 * - Never assigns based on time alone if multiple lessons or groups could match (`multiple_possible_lessons`).
 * - If a recurring schedule changes, asks for confirmation once (`needs_confirmation`) instead of silently learning the new schedule.
 * - If the match is strong, unambiguous, and backed by an active confirmed recurring rule, marks it `'automatically_matched'`.
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
    zoomMeetingId?: string;
    calendarEventTitle?: string;
    calendarEventUid?: string;
    participantNames?: string[];
    hasAiSummary?: boolean;
    aiSummaryExcerpt?: string;
    importedAt?: string;
    removedFromLibrary?: boolean;
    detectedPartSlot?: 'part1' | 'part2';
    pairedRecordingId?: string;
    part2StartGapMinutes?: number;
  },
  lessons: Lesson[],
  groups: Group[],
  students: Student[],
  explicitLearningRecords?: GrainGroupLearningRecord[],
  part2ConfigInput?: Partial<GrainPart2DetectionConfig>,
  explicitWeeklySessions?: GroupWeeklySession[],
  explicitZoomHistory?: ZoomMeetingHistory[]
): GrainDiscoveredRecording {
  const durationMinutes = Math.max(1, Math.round((recording.durationSeconds || 0) / 60));
  const cleanRecUrl = String(recording.recordingUrl || '').trim();
  const part2Config = normalizePart2DetectionConfig(part2ConfigInput);

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
      confidenceLevel: 'low',
      matchReasons: ['Recording URL is missing or inaccessible in Grain.'],
      candidates: [],
      workflowStatuses: ['needs_teacher_confirmation'],
      lastSyncedAt: new Date().toISOString()
    };
  }

  const activeGroups = (groups || []).filter((g) => g && !g.deleted);
  const learningRecords = explicitLearningRecords || loadGrainGroupLearningRecords(activeGroups);
  const weeklySessions = (explicitWeeklySessions || []).filter((s) => s && !s.deleted);
  const zoomHistory = (explicitZoomHistory || []).filter((h) => h && !h.deleted);

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
  const grainZoomMeetingId =
    extractNumericZoomMeetingId(recording.zoomMeetingId) ||
    normalizedGrainZoom?.meetingId ||
    extractNumericZoomMeetingId(recording.zoomMeetingUrl);
  const parsedStdTopic =
    parseStandardizedZoomTopic(recording.title) ||
    parseStandardizedZoomTopic(recording.calendarEventTitle);
  const cleanRecCalendarUid = String(recording.calendarEventUid || '').trim();
  const normRecTitle = normalizeNameForComparison(`${recording.title} ${recording.calendarEventTitle || ''}`);
  const normParticipants = (recording.participantNames || []).map(normalizeNameForComparison).filter(Boolean);

  const candidates: GrainLessonMatchCandidate[] = [];

  for (const lesson of activeLessons) {
    const lessonTime = parseLessonDateTimeMinutes(lesson.date, lesson.time);
    if (!lessonTime.valid || !recTime.valid) continue;

    // Account for local date/time as well as timezone / DST offsets
    const epochDiffMinutes = Math.round(Math.abs(recTime.epochMs - lessonTime.epochMsLocal) / 60000);
    const sameLocalDate = recTime.dateYmd === lessonTime.dateYmd;
    const sameUtcDate = recTime.utcDateYmd === lessonTime.dateYmd;
    const localClockDiff = Math.abs(recTime.minutesOfDay - lessonTime.minutesOfDay);
    const utcClockDiff = Math.abs(recTime.utcMinutesOfDay - lessonTime.minutesOfDay);

    // Handle DST / timezone 60-minute shift when ISO string has explicit UTC offset
    const effectiveTimeDeltaMinutes = sameLocalDate
      ? Math.min(localClockDiff, epochDiffMinutes)
      : sameUtcDate
      ? Math.min(epochDiffMinutes, utcClockDiff)
      : epochDiffMinutes;

    const signedMinutesFromLessonStart = sameLocalDate
      ? recTime.minutesOfDay - lessonTime.minutesOfDay
      : Math.round((recTime.epochMs - lessonTime.epochMsLocal) / 60000);

    const lessonDuration = Math.max(15, Number(lesson.durationMinutes || lesson.duration || 60));
    const isWithinPart2OffsetWindow =
      signedMinutesFromLessonStart >= part2Config.minGapMinutes &&
      signedMinutesFromLessonStart <= part2Config.maxGapMinutes;

    const isDateAndTimeAligned =
      (sameLocalDate || sameUtcDate || epochDiffMinutes <= 180) &&
      (effectiveTimeDeltaMinutes <= Math.max(75, lessonDuration + 20) || isWithinPart2OffsetWindow);

    // Never assign a recording based on student/participant name or title alone when date/time conflicts!
    if (!isDateAndTimeAligned) {
      continue;
    }

    const group = activeGroups.find((g) => g.id === lesson.groupId);
    const groupSessions = weeklySessions.filter((s) => s.groupId === lesson.groupId);
    const matchedActiveSessionBySlot = groupSessions.find(
      (s) => s.weekday === lessonTime.weekday && Math.abs(Number(s.startTime.slice(0, 2)) * 60 + Number(s.startTime.slice(3, 5)) - lessonTime.minutesOfDay) <= 30
    );

    const rawLessonZoom =
      lesson.zoomMeetingLink ||
      lesson.meetingLink ||
      matchedActiveSessionBySlot?.zoomJoinUrl ||
      group?.zoomLink ||
      '';
    const normalizedLessonZoom = normalizeZoomMeetingUrl(rawLessonZoom);
    const effectiveLessonZoomId =
      matchedActiveSessionBySlot?.zoomMeetingId ||
      normalizedLessonZoom?.meetingId;

    // Tier 1 check: Zoom Meeting ID (active session, lesson/group link, or immutable ZoomMeetingHistory)
    let matchedFromHistory = false;
    let matchedZoomSession: GroupWeeklySession | undefined = matchedActiveSessionBySlot;
    let tier1ZoomIdMatched = false;

    if (grainZoomMeetingId) {
      const activeSessionMatch = groupSessions.find((s) => s.zoomMeetingId === grainZoomMeetingId);
      if (activeSessionMatch) {
        tier1ZoomIdMatched = true;
        matchedZoomSession = activeSessionMatch;
      } else if (lesson.groupId) {
        const historyMatch = zoomHistory.find(
          (h) =>
            h.groupId === lesson.groupId &&
            (h.previousZoomMeetingId === grainZoomMeetingId || h.newZoomMeetingId === grainZoomMeetingId)
        );
        if (historyMatch) {
          tier1ZoomIdMatched = true;
          matchedFromHistory = true;
          matchedZoomSession =
            groupSessions.find((s) => s.id === historyMatch.sessionId) || matchedActiveSessionBySlot;
        }
      }
      if (!tier1ZoomIdMatched && effectiveLessonZoomId && effectiveLessonZoomId === grainZoomMeetingId) {
        tier1ZoomIdMatched = true;
      }
    }

    let zoomLinkStatus: GrainZoomLinkVerificationStatus = 'not_exposed_by_grain';
    if (tier1ZoomIdMatched) {
      zoomLinkStatus = 'verified_match';
    } else if (!normalizedLessonZoom && groupSessions.length === 0) {
      zoomLinkStatus = 'missing_on_lesson';
    } else if (!normalizedGrainZoom && !grainZoomMeetingId) {
      zoomLinkStatus = 'not_exposed_by_grain';
    } else {
      const idMatch =
        effectiveLessonZoomId &&
        grainZoomMeetingId &&
        effectiveLessonZoomId === grainZoomMeetingId;
      const urlMatch =
        normalizedLessonZoom &&
        normalizedGrainZoom &&
        normalizedLessonZoom.canonicalUrl === normalizedGrainZoom.canonicalUrl;
      zoomLinkStatus = idMatch || urlMatch ? 'verified_match' : 'mismatch';
    }

    if (zoomLinkStatus === 'mismatch' && effectiveTimeDeltaMinutes > 30) {
      continue;
    }

    let score = 0;
    const reasons: string[] = [];

    // 1. Primary Evidence: Lesson Date & Start Time alignment (or Part 2 ~40m offset alignment)
    if (effectiveTimeDeltaMinutes <= 10) {
      score += 64;
      reasons.push(`Exact date & start time match (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    } else if (effectiveTimeDeltaMinutes <= 25) {
      score += 52;
      reasons.push(`Date & close start time match (${lesson.date} ${lesson.time}, Δ ${effectiveTimeDeltaMinutes}m)`);
    } else if (isWithinPart2OffsetWindow) {
      score += 54;
      reasons.push(
        `Date & Part 2 start-time offset match (+${signedMinutesFromLessonStart}m after ${lesson.time})`
      );
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

    // 3. Primary/Learned Evidence: Smart Recurring Group Learning History (keyed by stable group.id)
    let learnedGroupMatchBoost = 0;
    let learnedRecurringRuleId: string | undefined;
    let scheduleChangedRequiresConfirmation = false;
    let wasCorrectedAway = false;

    if (lesson.groupId) {
      const learnedEval = evaluateGroupLearningBoostForCandidate({
        groupId: lesson.groupId,
        recordingDayOfWeek: sameLocalDate ? recTime.dayOfWeek : lessonTime.weekday,
        recordingMinutesOfDay: sameLocalDate ? recTime.minutesOfDay : lessonTime.minutesOfDay + signedMinutesFromLessonStart,
        recordingDurationMinutes: durationMinutes,
        lessonWeekday: lessonTime.weekday,
        lessonMinutesOfDay: lessonTime.minutesOfDay,
        normalizedTitle: normRecTitle,
        normalizedParticipants: normParticipants,
        learningRecords,
        activeGroups
      });
      learnedGroupMatchBoost = learnedEval.boostPoints;
      learnedRecurringRuleId = learnedEval.learnedRecurringRuleId;
      scheduleChangedRequiresConfirmation = learnedEval.scheduleChangedRequiresConfirmation;
      wasCorrectedAway = learnedEval.wasCorrectedAway;
      if (learnedGroupMatchBoost !== 0 || learnedEval.reasons.length > 0) {
        score += learnedGroupMatchBoost;
        reasons.push(...learnedEval.reasons);
      }
    }

    // 4. Secondary Evidence: Duration consistency (up to 14 points)
    const durationDiff = Math.abs(durationMinutes - lessonDuration);
    const isLikelySplitPart =
      Math.abs(durationMinutes - Math.round(lessonDuration / 2)) <= 15 ||
      (durationMinutes >= 25 && durationMinutes <= 45);
    if (durationDiff <= 15) {
      score += 14;
      reasons.push(`Duration matches lesson (${durationMinutes}m vs ${lessonDuration}m)`);
    } else if (isLikelySplitPart) {
      score += 12;
      reasons.push(`Duration matches multi-part session segment (${durationMinutes}m of ${lessonDuration}m)`);
    } else if (durationDiff <= 30) {
      score += 6;
      reasons.push(`Duration reasonably close (${durationMinutes}m vs ${lessonDuration}m)`);
    }

    // 5. Tier 2 Standardized Topic Check & Secondary Title Evidence
    const normLessonTitle = normalizeNameForComparison(lesson.title);
    const normGroupName = normalizeNameForComparison(group?.name || lesson.groupName);
    const normStudentName = normalizeNameForComparison(lesson.studentName);

    let standardizedTopicMatched = false;
    const parsedStdTopicLabel = parsedStdTopic
      ? `${parsedStdTopic.weekdayName} - ${parsedStdTopic.startTime} - ${parsedStdTopic.groupName}`
      : '';
    if (parsedStdTopic && group?.name) {
      const topicGroupNorm = normalizeNameForComparison(parsedStdTopic.groupName);
      const exactGroupMatch =
        topicGroupNorm === normGroupName ||
        zoomHistory.some(
          (h) =>
            h.groupId === group.id &&
            (normalizeNameForComparison(h.previousTopic) === normalizeNameForComparison(parsedStdTopicLabel) ||
              normalizeNameForComparison(h.newTopic) === normalizeNameForComparison(parsedStdTopicLabel))
        );
      if (exactGroupMatch) {
        const topicWeekday = normalizeWeekdayIndex(parsedStdTopic.weekdayName);
        if (topicWeekday === lessonTime.weekday) {
          standardizedTopicMatched = true;
        }
      }
    }

    // Tier 4 Calendar Event UID Match
    let calendarUidMatched = false;
    const matchedCalendarSession = cleanRecCalendarUid
      ? groupSessions.find((s) => s.calendarEventUid === cleanRecCalendarUid)
      : undefined;
    if (matchedCalendarSession) {
      calendarUidMatched = true;
      matchedZoomSession = matchedZoomSession || matchedCalendarSession;
    }

    const secondaryTitleMatched = Boolean(
      standardizedTopicMatched ||
        (normGroupName && normGroupName.length >= 3 && normRecTitle.includes(normGroupName)) ||
        (normLessonTitle && normLessonTitle.length >= 3 && normRecTitle.includes(normLessonTitle)) ||
        (normStudentName && normStudentName.length >= 3 && normRecTitle.includes(normStudentName))
    );

    if (standardizedTopicMatched) {
      score += 26;
      reasons.push(`Standardized Zoom title matched ("${parsedStdTopicLabel}")`);
    } else if (secondaryTitleMatched) {
      score += 10;
      reasons.push('Recording title supports lesson/group name');
    }

    if (calendarUidMatched) {
      score += 18;
      reasons.push(`Calendar Event UID matched (${cleanRecCalendarUid})`);
    }

    // 6. Tier 1 Zoom Meeting ID Boost / Mismatch Check
    if (tier1ZoomIdMatched) {
      score += matchedFromHistory ? 28 : 34;
      reasons.push(
        matchedFromHistory
          ? `Zoom Meeting ID matched via session history (${grainZoomMeetingId})`
          : `Zoom Meeting ID matched active weekly session (${grainZoomMeetingId})`
      );
    } else if (zoomLinkStatus === 'verified_match') {
      score += 15;
      reasons.push(
        `Optional Zoom Meeting ID verified (${normalizedLessonZoom?.meetingId || normalizedLessonZoom?.canonicalUrl})`
      );
    } else if (zoomLinkStatus === 'mismatch') {
      score -= 22;
      reasons.push('Warning: Zoom Meeting ID differs from lesson Zoom link');
    }

    const clampedScore = Math.max(0, Math.min(100, score));
    const matchTier: GrainMatchTier = tier1ZoomIdMatched
      ? 'zoom_meeting_id'
      : standardizedTopicMatched
      ? 'standardized_topic'
      : calendarUidMatched
      ? 'calendar_uid'
      : effectiveTimeDeltaMinutes <= 25 || isWithinPart2OffsetWindow
      ? 'date_and_session'
      : 'metadata_heuristic';
    const confidenceLevel: GrainConfidenceLevel =
      clampedScore >= 82 ? 'high' : clampedScore >= 55 ? 'medium' : 'low';

    const detectedPartSlot: 'part1' | 'part2' =
      recording.detectedPartSlot || (isWithinPart2OffsetWindow && effectiveTimeDeltaMinutes > 25 ? 'part2' : 'part1');

    const evidence: GrainMatchEvidence = {
      lessonDateMatch: sameLocalDate || sameUtcDate,
      recordingDateLocal: recTime.dateYmd,
      recordingStartTimeLocal: recTime.timeHm,
      timeDeltaMinutes: effectiveTimeDeltaMinutes,
      withinTimeWindow: isDateAndTimeAligned,
      zoomLinkStatus,
      normalizedLessonZoomId: effectiveLessonZoomId || normalizedLessonZoom?.canonicalUrl,
      normalizedGrainZoomId: grainZoomMeetingId || normalizedGrainZoom?.canonicalUrl,
      durationMinutesRecording: durationMinutes,
      durationMinutesLesson: lessonDuration,
      durationDiffMinutes: durationDiff,
      secondaryTitleMatched,
      secondaryParticipantsMatchedCount: matchedStudentIds.length,
      matchedStudentIds: matchedStudentIds.length > 0 ? matchedStudentIds : undefined,
      matchedGroupId: lesson.groupId || undefined,
      learnedGroupMatchBoost: learnedGroupMatchBoost !== 0 ? learnedGroupMatchBoost : undefined,
      learnedRecurringRuleId,
      scheduleChangedRequiresConfirmation: scheduleChangedRequiresConfirmation || undefined,
      detectedPartSlot,
      pairedRecordingId: recording.pairedRecordingId,
      part2StartGapMinutes: recording.part2StartGapMinutes,
      matchTier,
      confidenceLevel,
      matchedSessionId: matchedZoomSession?.id,
      matchedSessionCode: matchedZoomSession?.sessionCode,
      matchedFromHistory: matchedFromHistory || undefined,
      reasons
    };

    const existingR1 = (lesson.recordingLink || lesson.report?.recordingLink || '').trim() || undefined;
    const existingR2 = (lesson.recordingLink2 || lesson.report?.recordingLink2 || '').trim() || undefined;
    const recommendedSlot: 'recordingLink' | 'recordingLink2' =
      detectedPartSlot === 'part2' ? 'recordingLink2' : 'recordingLink';

    const hasStrongStandardizedEvidence =
      ((tier1ZoomIdMatched && Boolean(matchedZoomSession || matchedFromHistory)) ||
        standardizedTopicMatched ||
        calendarUidMatched) &&
      zoomLinkStatus !== 'mismatch' &&
      clampedScore >= 80;

    const canAutoAssign = Boolean(
      !wasCorrectedAway &&
        zoomLinkStatus !== 'mismatch' &&
        ((learnedRecurringRuleId && !scheduleChangedRequiresConfirmation && clampedScore >= 78) ||
          hasStrongStandardizedEvidence)
    );

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
      matchTier,
      confidenceLevel,
      evidence,
      existingRecordingLink: existingR1,
      existingRecordingLink2: existingR2,
      canAutoAssign,
      recommendedSlot
    });
  }

  candidates.sort((a, b) => b.confidenceScore - a.confidenceScore);

  if (alreadyLinkedLesson) {
    const linkedGroup = activeGroups.find((g) => g.id === alreadyLinkedLesson.groupId);
    const topCandidate = candidates.find((c) => c.lessonId === alreadyLinkedLesson.id) || candidates[0];
    const isLinkedInPart2 =
      (alreadyLinkedLesson.recordingLink2 || alreadyLinkedLesson.report?.recordingLink2 || '').trim() === cleanRecUrl ||
      alreadyLinkedLesson.grainMeta?.recordingIdPart2 === recording.id;
    const partSlot: 'part1' | 'part2' = isLinkedInPart2 ? 'part2' : 'part1';
    const statuses: GrainWorkflowStatusBadge[] = [
      ...(alreadyLinkedLesson.grainMeta?.matchedAutomatically ? (['automatically_matched'] as const) : []),
      partSlot === 'part2' ? 'part2_detected' : 'part1_detected'
    ];
    if (alreadyLinkedLesson.grainMeta?.extractedLessonContent) {
      if (alreadyLinkedLesson.grainMeta.extractedLessonContent.transcriptStatus === 'transcript_unavailable') {
        statuses.push('transcript_unavailable');
      } else {
        statuses.push('lesson_content_extracted');
      }
    }
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
      matchTier: topCandidate?.matchTier || 'date_and_session',
      confidenceLevel: 'high',
      matchedSessionId: topCandidate?.evidence?.matchedSessionId,
      matchedSessionCode: topCandidate?.evidence?.matchedSessionCode,
      matchReasons: [
        `Already linked to lesson "${alreadyLinkedLesson.title || linkedGroup?.name || alreadyLinkedLesson.groupName}" (${alreadyLinkedLesson.date})`
      ],
      evidence: topCandidate?.evidence,
      candidates,
      detectedPartSlot: partSlot,
      workflowStatuses: statuses,
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
      confidenceLevel: 'low',
      matchReasons: ['No scheduled lesson matched the recording date and time window.'],
      candidates: [],
      workflowStatuses: ['needs_teacher_confirmation'],
      lastSyncedAt: new Date().toISOString()
    };
  }

  // Requirement 2: Never assign based on time alone if multiple lessons or groups could match!
  if (
    candidates.length >= 2 &&
    candidates[1].confidenceScore >= 45 &&
    Math.abs(candidates[0].confidenceScore - candidates[1].confidenceScore) <= 14
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
      matchTier: candidates[0].matchTier,
      confidenceLevel: candidates[0].confidenceLevel,
      matchedSessionId: candidates[0].evidence.matchedSessionId,
      matchedSessionCode: candidates[0].evidence.matchedSessionCode,
      matchReasons: [
        `Multiple possible lessons (${candidates.length}) overlap this date/time window. Teacher selection required.`,
        ...candidates[0].evidence.reasons
      ],
      evidence: candidates[0].evidence,
      candidates: candidates.map((c) => ({ ...c, canAutoAssign: false })),
      workflowStatuses: ['needs_teacher_confirmation'],
      lastSyncedAt: new Date().toISOString()
    };
  }

  const best = candidates[0];

  // Requirement 2: If a recurring schedule changes, do NOT silently auto-assign; ask for confirmation once!
  if (best.evidence.scheduleChangedRequiresConfirmation) {
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: effectiveShareClassification,
      matchStatus: 'needs_confirmation',
      suggestedLessonId: best.lessonId,
      matchedGroupId: best.groupId,
      matchedGroupName: best.groupName,
      matchedStudentIds: best.evidence.matchedStudentIds,
      confidenceScore: best.confidenceScore,
      matchTier: best.matchTier,
      confidenceLevel: best.confidenceLevel,
      matchedSessionId: best.evidence.matchedSessionId,
      matchedSessionCode: best.evidence.matchedSessionCode,
      matchReasons: best.evidence.reasons,
      evidence: best.evidence,
      candidates: candidates.map((c) => ({ ...c, canAutoAssign: false })),
      detectedPartSlot: best.evidence.detectedPartSlot || 'part1',
      workflowStatuses: ['needs_teacher_confirmation'],
      lastSyncedAt: new Date().toISOString()
    };
  }

  // Auto-match when backed by active confirmed recurring rule OR strong Tier 1/2/4 standardized identity
  if (
    best.canAutoAssign &&
    (best.evidence.learnedRecurringRuleId ||
      best.evidence.matchedSessionId ||
      best.evidence.matchedFromHistory ||
      best.matchTier === 'standardized_topic' ||
      best.matchTier === 'calendar_uid')
  ) {
    const partSlot = best.evidence.detectedPartSlot || 'part1';
    return {
      ...recording,
      durationMinutes,
      shareAccessClassification: effectiveShareClassification,
      matchStatus: 'automatically_matched',
      suggestedLessonId: best.lessonId,
      matchedGroupId: best.groupId,
      matchedGroupName: best.groupName,
      matchedStudentIds: best.evidence.matchedStudentIds,
      confidenceScore: best.confidenceScore,
      matchTier: best.matchTier,
      confidenceLevel: best.confidenceLevel,
      matchedSessionId: best.evidence.matchedSessionId,
      matchedSessionCode: best.evidence.matchedSessionCode,
      matchReasons: best.evidence.reasons,
      evidence: best.evidence,
      candidates,
      detectedPartSlot: partSlot,
      learnedRecurringRuleId: best.evidence.learnedRecurringRuleId,
      workflowStatuses: [
        'automatically_matched',
        partSlot === 'part2' ? 'part2_detected' : 'part1_detected'
      ],
      lastSyncedAt: new Date().toISOString()
    };
  }

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
    matchTier: best.matchTier,
    confidenceLevel: best.confidenceLevel,
    matchedSessionId: best.evidence.matchedSessionId,
    matchedSessionCode: best.evidence.matchedSessionCode,
    matchReasons: best.evidence.reasons,
    evidence: best.evidence,
    candidates,
    detectedPartSlot: best.evidence.detectedPartSlot || 'part1',
    workflowStatuses: [
      best.evidence.detectedPartSlot === 'part2' ? 'part2_detected' : 'part1_detected',
      'needs_teacher_confirmation'
    ],
    lastSyncedAt: new Date().toISOString()
  };
}

/**
 * Requirement 3: Automatic Second-Part Detection (`detectGrainTwoPartRecordingPairs`).
 * - Identifies Part 1 and Part 2 pairs belonging to the same lesson, date, and group.
 * - Expected start-time difference: ~40 minutes (accepts 40, 41, 42 minutes and configurable `[minGapMinutes, maxGapMinutes]`).
 * - Supports recordings imported in either order (Part 1 before Part 2, or Part 2 before Part 1).
 * - Checks all other lessons on that date to avoid confusing Part 2 with another independent lesson starting ~40 minutes later.
 * - Marks ambiguous second recordings as `'needs_confirmation'` (`'needs_teacher_confirmation'`) instead of auto-assigning.
 */
export function detectGrainTwoPartRecordingPairs(options: {
  recordings: GrainDiscoveredRecording[];
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  learningRecords?: GrainGroupLearningRecord[];
  part2Config?: Partial<GrainPart2DetectionConfig>;
}): GrainDiscoveredRecording[] {
  const { recordings, lessons, groups } = options;
  const cfg = normalizePart2DetectionConfig(options.part2Config);
  const activeLessons = (lessons || []).filter((l) => l && !l.deleted && l.status !== 'cancelled');
  const activeGroups = (groups || []).filter((g) => g && !g.deleted);

  const byId = new Map<string, GrainDiscoveredRecording>();
  for (const r of recordings || []) {
    byId.set(r.id, {
      ...r,
      workflowStatuses: Array.isArray(r.workflowStatuses) ? [...r.workflowStatuses] : []
    });
  }

  // Group recordings by candidate/confirmed lessonId
  for (const lesson of activeLessons) {
    const lessonTime = parseLessonDateTimeMinutes(lesson.date, lesson.time);
    if (!lessonTime.valid) continue;

    // Collect all recordings that either are already linked to this lesson or have this lesson as top candidate on the same date
    const lessonRecordings: GrainDiscoveredRecording[] = [];
    for (const rec of byId.values()) {
      if (rec.removedFromLibrary) continue;
      const isLinkedToLesson = rec.confirmedLessonId === lesson.id;
      const isTopCandidateForLesson =
        !rec.confirmedLessonId &&
        rec.suggestedLessonId === lesson.id &&
        rec.candidates.some((c) => c.lessonId === lesson.id);

      if (isLinkedToLesson || isTopCandidateForLesson) {
        lessonRecordings.push(rec);
      }
    }

    // Also check if the lesson already has Part 1 stored in `lesson.grainMeta` (even if only Part 2 is in the current batch)
    const existingPart1Id = lesson.grainMeta?.recordingId;
    const existingPart1Timestamp = lesson.grainMeta?.startTimestamp;

    // Sort chronologically by start timestamp so order of import (Part 2 before Part 1 or vice-versa) does not matter!
    lessonRecordings.sort((a, b) => {
      const msA = Date.parse(a.startDatetime || '');
      const msB = Date.parse(b.startDatetime || '');
      if (Number.isFinite(msA) && Number.isFinite(msB) && msA !== msB) {
        return msA - msB;
      }
      return String(a.startDatetime || '').localeCompare(String(b.startDatetime || ''));
    });

    // Helper: check if another independent lesson starts near `part2Rec`'s start time
    const checkIndependentLessonConflictAtPart2Time = (part2Rec: GrainDiscoveredRecording): {
      belongsToAnotherLesson: boolean;
      ambiguousWithAnotherLesson: boolean;
      conflictingLessonId?: string;
    } => {
      const p2Time = formatLocalYmdAndTimeFromIso(part2Rec.startDatetime);
      if (!p2Time.valid) return { belongsToAnotherLesson: false, ambiguousWithAnotherLesson: false };

      const normP2Title = normalizeNameForComparison(`${part2Rec.title} ${part2Rec.calendarEventTitle || ''}`);
      const lessonGroup = activeGroups.find((g) => g.id === lesson.groupId);
      const normLessonGroupName = normalizeNameForComparison(lessonGroup?.name || lesson.groupName);

      for (const other of activeLessons) {
        if (other.id === lesson.id) continue;
        if (other.date !== lesson.date && other.date !== p2Time.dateYmd && other.date !== p2Time.utcDateYmd) {
          continue;
        }
        const otherTime = parseLessonDateTimeMinutes(other.date, other.time);
        if (!otherTime.valid) continue;

        const diffToOtherStart =
          other.date === p2Time.dateYmd
            ? Math.abs(p2Time.minutesOfDay - otherTime.minutesOfDay)
            : Math.round(Math.abs(p2Time.epochMs - otherTime.epochMsLocal) / 60000);

        if (diffToOtherStart <= 18) {
          const otherGroup = activeGroups.find((g) => g.id === other.groupId);
          const normOtherGroupName = normalizeNameForComparison(otherGroup?.name || other.groupName);
          const normOtherTitle = normalizeNameForComparison(other.title);

          // Does part2Rec's title explicitly match the other lesson's group/title?
          const matchesOtherTitle = Boolean(
            (normOtherGroupName && normOtherGroupName.length >= 3 && normP2Title.includes(normOtherGroupName)) ||
              (normOtherTitle && normOtherTitle.length >= 3 && normP2Title.includes(normOtherTitle))
          );
          const matchesTargetLessonTitle = Boolean(
            normLessonGroupName && normLessonGroupName.length >= 3 && normP2Title.includes(normLessonGroupName)
          );

          if (matchesOtherTitle && !matchesTargetLessonTitle) {
            return {
              belongsToAnotherLesson: true,
              ambiguousWithAnotherLesson: false,
              conflictingLessonId: other.id
            };
          }

          if (!matchesTargetLessonTitle) {
            return {
              belongsToAnotherLesson: false,
              ambiguousWithAnotherLesson: true,
              conflictingLessonId: other.id
            };
          }
        }
      }

      return { belongsToAnotherLesson: false, ambiguousWithAnotherLesson: false };
    };

    if (lessonRecordings.length >= 2) {
      // Find a pair (earlier, later) separated by [cfg.minGapMinutes, cfg.maxGapMinutes] (e.g. 40, 41, 42 minutes)
      for (let i = 0; i < lessonRecordings.length; i++) {
        for (let j = i + 1; j < lessonRecordings.length; j++) {
          const earlier = byId.get(lessonRecordings[i].id)!;
          const later = byId.get(lessonRecordings[j].id)!;

          const ms1 = Date.parse(earlier.startDatetime);
          const ms2 = Date.parse(later.startDatetime);
          if (!Number.isFinite(ms1) || !Number.isFinite(ms2)) continue;

          const gapMinutes = Math.round((ms2 - ms1) / 60000);
          if (gapMinutes < cfg.minGapMinutes || gapMinutes > cfg.maxGapMinutes) {
            continue;
          }

          // Check Zoom ID consistency if both have Zoom meeting URLs
          const z1 = normalizeZoomMeetingUrl(earlier.zoomMeetingUrl);
          const z2 = normalizeZoomMeetingUrl(later.zoomMeetingUrl);
          if (z1?.meetingId && z2?.meetingId && z1.meetingId !== z2.meetingId) {
            continue;
          }

          // Check if later recording actually belongs to another independent lesson starting at ~17:40
          const conflictCheck = checkIndependentLessonConflictAtPart2Time(later);
          if (conflictCheck.belongsToAnotherLesson) {
            continue;
          }

          const earlierStatuses = new Set<GrainWorkflowStatusBadge>(earlier.workflowStatuses || []);
          earlierStatuses.add('part1_detected');

          const laterStatuses = new Set<GrainWorkflowStatusBadge>(later.workflowStatuses || []);
          laterStatuses.add('part2_detected');

          let nextLaterMatchStatus: GrainMatchStatus = later.matchStatus;
          if (conflictCheck.ambiguousWithAnotherLesson) {
            nextLaterMatchStatus = 'needs_confirmation';
            laterStatuses.delete('automatically_matched');
            laterStatuses.add('needs_teacher_confirmation');
          } else if (
            later.matchStatus !== 'already_linked' &&
            (earlier.matchStatus === 'already_linked' || earlier.matchStatus === 'automatically_matched')
          ) {
            nextLaterMatchStatus = 'automatically_matched';
            laterStatuses.delete('needs_teacher_confirmation');
            laterStatuses.add('automatically_matched');
          }

          byId.set(earlier.id, {
            ...earlier,
            detectedPartSlot: 'part1',
            pairedRecordingId: later.id,
            part2StartGapMinutes: gapMinutes,
            workflowStatuses: Array.from(earlierStatuses),
            matchReasons: Array.from(
              new Set([
                ...earlier.matchReasons,
                `Part 1 of two-part lesson (paired with Part 2 starting +${gapMinutes}m later)`
              ])
            )
          });

          byId.set(later.id, {
            ...later,
            detectedPartSlot: 'part2',
            pairedRecordingId: earlier.id,
            part2StartGapMinutes: gapMinutes,
            suggestedLessonId: lesson.id,
            matchedGroupId: lesson.groupId || later.matchedGroupId,
            matchedGroupName: lesson.groupName || later.matchedGroupName,
            matchStatus: nextLaterMatchStatus,
            workflowStatuses: Array.from(laterStatuses),
            matchReasons: Array.from(
              new Set([
                ...later.matchReasons,
                conflictCheck.ambiguousWithAnotherLesson
                  ? `Potential Part 2 (+${gapMinutes}m after Part 1), but overlaps another scheduled lesson — teacher confirmation required`
                  : `Part 2 detected (+${gapMinutes}m after Part 1 on ${lesson.date})`
              ])
            )
          });
        }
      }
    } else if (lessonRecordings.length === 1 && existingPart1Id && existingPart1Timestamp) {
      // Lesson already had Part 1 linked from an earlier sync, and only Part 2 is in this sync
      const rec = byId.get(lessonRecordings[0].id)!;
      if (rec.id !== existingPart1Id) {
        const ms1 = Date.parse(existingPart1Timestamp);
        const ms2 = Date.parse(rec.startDatetime);
        if (Number.isFinite(ms1) && Number.isFinite(ms2)) {
          const gapMinutes = Math.round((ms2 - ms1) / 60000);
          if (gapMinutes >= cfg.minGapMinutes && gapMinutes <= cfg.maxGapMinutes) {
            const conflictCheck = checkIndependentLessonConflictAtPart2Time(rec);
            if (!conflictCheck.belongsToAnotherLesson) {
              const statuses = new Set<GrainWorkflowStatusBadge>(rec.workflowStatuses || []);
              statuses.add('part2_detected');
              let nextStatus: GrainMatchStatus = rec.matchStatus;
              if (conflictCheck.ambiguousWithAnotherLesson) {
                nextStatus = 'needs_confirmation';
                statuses.delete('automatically_matched');
                statuses.add('needs_teacher_confirmation');
              } else if (rec.matchStatus !== 'already_linked') {
                nextStatus = 'automatically_matched';
                statuses.delete('needs_teacher_confirmation');
                statuses.add('automatically_matched');
              }
              byId.set(rec.id, {
                ...rec,
                detectedPartSlot: 'part2',
                pairedRecordingId: existingPart1Id,
                part2StartGapMinutes: gapMinutes,
                suggestedLessonId: lesson.id,
                matchedGroupId: lesson.groupId || rec.matchedGroupId,
                matchStatus: nextStatus,
                workflowStatuses: Array.from(statuses),
                matchReasons: Array.from(
                  new Set([
                    ...rec.matchReasons,
                    `Part 2 detected (+${gapMinutes}m after confirmed Part 1 on ${lesson.date})`
                  ])
                )
              });
            }
          }
        }
      }
    }
  }

  return Array.from(byId.values());
}

// ==========================================
// REQUIREMENT 4 & 5: AUTOMATIC 7-SECTION GERMAN LESSON CONTENT EXTRACTION
// ==========================================

const EXTENDED_GERMAN_GRAMMAR_PATTERNS: Array<{
  id: string;
  pattern: RegExp;
  topic: string;
  explanationDe: string;
  explanationAr: string;
}> = [
  {
    id: 'akkusativ',
    pattern: /\b(akkusativ|den\s+[A-ZÄÖÜ]\w+|einen\s+[A-ZÄÖÜ]\w+|keinen\s+[A-ZÄÖÜ]\w+)\b/i,
    topic: 'Akkusativ (Bestimmter und unbestimmter Artikel)',
    explanationDe: 'Maskuline Nomen verändern im Akkusativ den Artikel: der → den, ein → einen, kein → keinen.',
    explanationAr: 'تحويل أداة التعريف المذكرة der إلى den والنكرة ein إلى einen في حالة المفعول به.'
  },
  {
    id: 'dativ',
    pattern: /\b(dativ|mit\s+dem\b|mit\s+der\b|zu\s+dem\b|zum\b|zur\b|bei\s+dem\b|nach\s+dem\b|helfen|danken|gefallen)\b/i,
    topic: 'Dativ (Artikel, Präpositionen und Dativverben)',
    explanationDe: 'Dativ nach Präpositionen (mit, nach, bei, zu, von) und Dativverben (helfen, danken, gefallen): der/das → dem, die → der.',
    explanationAr: 'استخدام حالة الجر (Dativ) مع حروف الجر وأفعال المفعول غير المباشر.'
  },
  {
    id: 'trennbare_verben',
    pattern: /\b(trennbar\w*\s+verb\w*|aufstehen|steh\w*\s+.*\s+auf|einkaufen|kauf\w*\s+.*\s+ein|anrufen|ruf\w*\s+.*\s+an|fernsehen|mitkommen|zurückkommen)\b/i,
    topic: 'Trennbare Verben im Hauptsatz',
    explanationDe: 'Das konjugierte Verb steht auf Position 2, das trennbare Präfix steht am Satzende.',
    explanationAr: 'انفصال المقطع الأمامي للفعل ووضعه في نهاية الجملة الخبرية.'
  },
  {
    id: 'modalverben',
    pattern: /\b(modalverb\w*|können|kannst|kann|müssen|musst|muss|wollen|willst|will|sollen|dürfen|darfst|darf|möchten|möchte)\b/i,
    topic: 'Modalverben mit Infinitiv am Satzende',
    explanationDe: 'Das Modalverb steht konjugiert auf Position 2, das Vollverb steht im Infinitiv am Satzende.',
    explanationAr: 'تصريف الفعل الناقص في الموقع الثاني ووضع الفعل الأساسي في المصدر آخر الجملة.'
  },
  {
    id: 'perfekt',
    pattern: /\b(perfekt|partizip\s+ii|partizip\s+2|ge[a-zäöüß]{3,14}(?:t|en)\b)/i,
    topic: 'Das Perfekt (Hilfsverb haben/sein + Partizip II)',
    explanationDe: 'Perfekt zur Beschreibung vergangener Ereignisse: haben oder sein auf Position 2 + Partizip II am Satzende.',
    explanationAr: 'صيغة الماضي التام باستخدام الفعل المساعد haben أو sein والتصريف الثالث في نهاية الجملة.'
  },
  {
    id: 'wechselpraepositionen',
    pattern: /\b(wechselpräposition\w*|wohin\b|in\s+den\b|auf\s+den\b|an\s+den\b|in\s+dem\b|auf\s+dem\b|an\s+dem\b)\b/i,
    topic: 'Wechselpräpositionen (Wo? + Dativ / Wohin? + Akkusativ)',
    explanationDe: 'Bei Ortsangaben (Wo?) steht der Dativ, bei Richtungsangaben (Wohin?) steht der Akkusativ.',
    explanationAr: 'حروف الجر المشتركة: استخدام Dativ مع السكون (Wo?) وAkkusativ مع الحركة (Wohin?).'
  },
  {
    id: 'nebensaetze',
    pattern: /\b(nebensatz|nebensätze|weil\b|dass\b|wenn\b|obwohl\b|verb\s+am\s+ende)\b/i,
    topic: 'Nebensätze mit Konjunktionen (weil, dass, wenn)',
    explanationDe: 'Im Nebensatz mit weil, dass oder wenn steht das konjugierte Verb ganz am Ende.',
    explanationAr: 'الجمل الفرعية في الألمانية مع الروابط (weil, dass, wenn) ووضع الفعل المصرف في آخر الجملة.'
  },
  {
    id: 'imperativ',
    pattern: /\b(imperativ|befehlsform|bitte\s+les\w*|bitte\s+schreib\w*|sprechen\s+sie|lies\b|sprich\b|gib\b)\b/i,
    topic: 'Der Imperativ (Aufforderungssätze)',
    explanationDe: 'Imperativformen für du, ihr und Sie steht das Verb auf Position 1.',
    explanationAr: 'صيغة الأمر في اللغة الألمانية مع الضمائر (du, ihr, Sie).'
  },
  {
    id: 'praeteritum',
    pattern: /\b(präteritum|war\b|waren\b|hatte\b|hatten\b|konnte\b|musste\b|wollte\b)\b/i,
    topic: 'Präteritum von sein, haben und Modalverben',
    explanationDe: 'Verwendung von war, hatte und Modalverben im Präteritum.',
    explanationAr: 'الماضي البسيط (Präteritum) مع أفعال الكينونة والتملك والأفعال الناقصة.'
  }
];

function normalizeGermanDedupKey(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/^(der|die|das)\s+/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Computes a deterministic fingerprint from recording IDs and normalized source content
 * so repeated syncs do not re-run or duplicate extraction unless Part 2 or a new transcript arrives.
 */
export function computeGrainLessonSourceFingerprint(
  items: Array<{ recordingId: string; text: string }>
): string {
  const canonical = items
    .map((i) => `${String(i.recordingId || '').trim()}:${String(i.text || '').trim().replace(/\s+/g, ' ')}`)
    .join('||');
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i++) {
    const ch = canonical.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `gfp_${items.map((x) => x.recordingId).join('_')}_${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}`;
}

/**
 * Deduplicates all 7 German lesson summary sections when merging Part 1 and Part 2.
 */
export function deduplicateGermanExtractedContent(
  core: GrainExtractedLessonContentCore
): GrainExtractedLessonContentCore {
  const dedupStrings = (list: string[], maxItems: number): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list || []) {
      const cleaned = redactGrainSecrets(String(raw || '').trim());
      if (!cleaned) continue;
      const key = normalizeGermanDedupKey(cleaned);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
      if (out.length >= maxItems) break;
    }
    return out;
  };

  const vocabSeen = new Set<string>();
  const dedupVocab: GrainExtractedVocabularyEntry[] = [];
  for (const item of core.neueWoerterUndRedemittel || []) {
    if (!item || typeof item !== 'object') continue;
    const rawGerman = redactGrainSecrets(String(item.german || '').trim());
    if (!rawGerman) continue;
    // Strip leading article if already provided in item.article
    const articleMatch = /^(der|die|das)\s+(.+)$/i.exec(rawGerman);
    const article = (item.article || (articleMatch ? articleMatch[1].toLowerCase() : undefined)) as
      | 'der'
      | 'die'
      | 'das'
      | undefined;
    const baseGerman = articleMatch ? articleMatch[2].trim() : rawGerman;
    const key = `${article || ''}:${normalizeGermanDedupKey(baseGerman)}`;
    if (!normalizeGermanDedupKey(baseGerman) || vocabSeen.has(key)) continue;
    vocabSeen.add(key);
    dedupVocab.push({
      german: baseGerman.slice(0, 100),
      ...(article && ['der', 'die', 'das'].includes(article) ? { article } : {}),
      ...(item.arabic ? { arabic: redactGrainSecrets(String(item.arabic).trim()).slice(0, 120) } : {}),
      ...(item.example ? { example: redactGrainSecrets(String(item.example).trim()).slice(0, 200) } : {})
    });
    if (dedupVocab.length >= 25) break;
  }

  const grammarSeen = new Set<string>();
  const dedupGrammar: GrainExtractedGrammarEntry[] = [];
  for (const g of core.grammatik || []) {
    if (!g || typeof g !== 'object') continue;
    const topic = redactGrainSecrets(String(g.topic || '').trim());
    if (!topic) continue;
    const key = normalizeGermanDedupKey(topic);
    if (!key || grammarSeen.has(key)) continue;
    grammarSeen.add(key);
    dedupGrammar.push({
      topic: topic.slice(0, 140),
      explanationDe: redactGrainSecrets(String(g.explanationDe || topic).trim()).slice(0, 260),
      ...(g.explanationAr ? { explanationAr: redactGrainSecrets(String(g.explanationAr).trim()).slice(0, 260) } : {})
    });
    if (dedupGrammar.length >= 12) break;
  }

  const cleanedCore: Omit<GrainExtractedLessonContentCore, 'formattedLessonSummaryDe'> = {
    themaDerStunde: redactGrainSecrets(String(core.themaDerStunde || '').trim()).slice(0, 220),
    behandelteInhalte: dedupStrings(core.behandelteInhalte || [], 12),
    neueWoerterUndRedemittel: dedupVocab,
    grammatik: dedupGrammar,
    beispiele: dedupStrings(core.beispiele || [], 12),
    uebungenUndAktivitaeten: dedupStrings(core.uebungenUndAktivitaeten || [], 10),
    offenePunkte: dedupStrings(core.offenePunkte || [], 10)
  };

  return {
    ...cleanedCore,
    formattedLessonSummaryDe: formatExtractedLessonContentSummary(cleanedCore)
  };
}

/**
 * Formats the 7 German sections into a structured internal summary string for `lesson.whatWasTaught`.
 */
export function formatExtractedLessonContentSummary(
  core: Omit<GrainExtractedLessonContentCore, 'formattedLessonSummaryDe'>
): string {
  if (!core.themaDerStunde && core.behandelteInhalte.length === 0 && core.neueWoerterUndRedemittel.length === 0 && core.grammatik.length === 0) {
    return '';
  }

  const sections: string[] = [];
  if (core.themaDerStunde) {
    sections.push(`Thema der Stunde: ${core.themaDerStunde}`);
  }
  if (core.behandelteInhalte.length > 0) {
    sections.push(`Behandelte Inhalte:\n${core.behandelteInhalte.map((i) => `• ${i}`).join('\n')}`);
  }
  if (core.neueWoerterUndRedemittel.length > 0) {
    const vocabLines = core.neueWoerterUndRedemittel.map((v) => {
      const term = v.article ? `${v.article} ${v.german}` : v.german;
      const ar = v.arabic ? ` (${v.arabic})` : '';
      const ex = v.example ? ` — z.B. „${v.example}“` : '';
      return `• ${term}${ar}${ex}`;
    });
    sections.push(`Neue Wörter und Redemittel:\n${vocabLines.join('\n')}`);
  }
  if (core.grammatik.length > 0) {
    const gramLines = core.grammatik.map((g) => `• ${g.topic}: ${g.explanationDe}`);
    sections.push(`Grammatik:\n${gramLines.join('\n')}`);
  }
  if (core.beispiele.length > 0) {
    sections.push(`Beispiele:\n${core.beispiele.map((b) => `• „${b}“`).join('\n')}`);
  }
  if (core.uebungenUndAktivitaeten.length > 0) {
    sections.push(`Übungen und Aktivitäten:\n${core.uebungenUndAktivitaeten.map((u) => `• ${u}`).join('\n')}`);
  }
  if (core.offenePunkte.length > 0) {
    sections.push(`Offene Punkte:\n${core.offenePunkte.map((o) => `• ${o}`).join('\n')}`);
  }
  return sections.join('\n\n');
}

/**
 * Deterministic pedagogical extractor for German lessons from Part 1 + Part 2
 * Grain Transcripts AND Grain AI Notes (`ai_summary`, `ai_template_sections`, `highlights`, `ai_action_items`).
 * Preserves authentic German words, articles, grammar topics, examples, exercises, and open points
 * without inventing unsupported content. Works completely independently without Gemini.
 */
export function extractStructuredGermanLessonContentDeterministically(options: {
  lessonTitle?: string;
  part1Text: string;
  part2Text?: string;
  part1AiNotes?: string;
  part2AiNotes?: string;
  part1ActionItems?: string[];
  part2ActionItems?: string[];
}): GrainExtractedLessonContentCore {
  const p1Transcript = redactGrainSecrets(String(options.part1Text || '').trim());
  const p2Transcript = redactGrainSecrets(String(options.part2Text || '').trim());
  const p1Notes = redactGrainSecrets(String(options.part1AiNotes || '').trim());
  const p2Notes = redactGrainSecrets(String(options.part2AiNotes || '').trim());
  const combined = [p1Transcript, p1Notes, p2Transcript, p2Notes].filter(Boolean).join('\n');

  if (!combined) {
    return {
      themaDerStunde: '',
      behandelteInhalte: [],
      neueWoerterUndRedemittel: [],
      grammatik: [],
      beispiele: [],
      uebungenUndAktivitaeten: [],
      offenePunkte: [],
      formattedLessonSummaryDe: ''
    };
  }

  // Strip markdown bullets and Grain speaker prefixes ("Speaker: ") while keeping structured note labels
  const NOTE_LABEL_PREFIX_REGEX =
    /^(thema(?:\s+der\s+stunde)?|topic|subject|summary|zusammenfassung|overview|überblick|(?:behandelte\s+)?inhalte?|topics?|key\s*takeaways?|neue\s+wörter(?:\s+und\s+redemittel)?|wortschatz|vokabeln|vocabulary|redemittel|grammatik|grammar|beispiele?|examples?|übung(?:en)?(?:\s+und\s+aktivitäten)?|aktivitäten|exercises?|activities?|highlight|offene[rn]?\s*punkte?|action\s*items?|next\s*steps?|hausaufgaben?)\s*[:\-]\s*(.+)$/i;

  const INLINE_SECTION_SPLIT_REGEX =
    /(?<=[.!?])\s+(?=(?:thema(?:\s+der\s+stunde)?|behandelte\s+inhalte|neue\s+wörter(?:\s+und\s+redemittel)?|grammatik|beispiele|übung(?:en)?(?:\s+und\s+aktivitäten)?|offene\s+punkte)\s*[:\-])/i;

  const rawLines = combined
    .split(/\n+/)
    .flatMap((line) => line.split(INLINE_SECTION_SPLIT_REGEX))
    .map((line) => line.replace(/^\s*(?:[-*•]+|\d+[.)])\s+/, '').trim())
    .map((line) => {
      if (NOTE_LABEL_PREFIX_REGEX.test(line)) return line;
      return line.replace(/^[A-Za-zÄÖÜäöüß\u0600-\u06FF0-9_.\-\s]{1,28}:\s+/, '').trim();
    })
    .filter(Boolean);

  const labeledNotes: Array<{ label: string; value: string }> = [];
  const plainLines: string[] = [];

  for (const line of rawLines) {
    const lblMatch = NOTE_LABEL_PREFIX_REGEX.exec(line);
    if (lblMatch) {
      labeledNotes.push({
        label: lblMatch[1].toLowerCase().trim(),
        value: lblMatch[2].trim()
      });
    } else {
      plainLines.push(line);
    }
  }

  const allSentences: string[] = [];
  for (const line of [...plainLines, ...labeledNotes.map((n) => n.value)]) {
    const parts = line
      .split(/(?<=[.!?؟])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4);
    allSentences.push(...parts);
  }

  // 1. Detect Grammar topics explicitly present in the combined transcript + AI Notes
  const grammatik: GrainExtractedGrammarEntry[] = [];
  for (const rule of EXTENDED_GERMAN_GRAMMAR_PATTERNS) {
    if (rule.pattern.test(combined)) {
      grammatik.push({
        topic: rule.topic,
        explanationDe: rule.explanationDe,
        explanationAr: rule.explanationAr
      });
    }
  }
  for (const note of labeledNotes) {
    if (/^(grammatik|grammar)$/i.test(note.label) && note.value.length >= 4) {
      const colonIdx = note.value.indexOf(':');
      const topic =
        colonIdx > 2 && colonIdx < 80 ? note.value.slice(0, colonIdx).trim() : note.value.slice(0, 120).trim();
      const explanationDe =
        colonIdx > 2 && colonIdx < 80 ? note.value.slice(colonIdx + 1).trim() || note.value : note.value;
      grammatik.push({
        topic,
        explanationDe: explanationDe.slice(0, 260)
      });
    }
  }

  // 2. Extract authentic German vocabulary with articles (der/die/das + Noun) and explicit Redemittel
  const STOP_NOUNS = new Set([
    'Thema',
    'Stunde',
    'Seite',
    'Übung',
    'Aufgabe',
    'Frage',
    'Antwort',
    'Beispiel',
    'Satz',
    'Teil',
    'Tag',
    'Name',
    'Highlight',
    'Punkt',
    'Summary',
    'Topic'
  ]);
  const neueWoerterUndRedemittel: GrainExtractedVocabularyEntry[] = [];
  const articleNounRegex = /\b(der|die|das)\s+([A-ZÄÖÜ][a-zäöüß]{2,24})\b/g;
  let m: RegExpExecArray | null;
  while ((m = articleNounRegex.exec(combined)) !== null) {
    const article = m[1].toLowerCase() as 'der' | 'die' | 'das';
    const noun = m[2];
    if (STOP_NOUNS.has(noun)) continue;

    // Look for an authentic sentence in allSentences containing this article + noun
    const matchingSentence = allSentences.find((s) =>
      new RegExp(`\\b(?:der|die|das|den|dem|einen|einem|eine)\\s+${noun}\\b`, 'i').test(s)
    );

    // Check if an explicit translation or meaning is mentioned near the noun
    let arabicMeaning: string | undefined;
    if (matchingSentence) {
      const arMatch = /([\u0600-\u06FF][\u0600-\u06FF\s،]{2,40})/.exec(matchingSentence);
      if (arMatch) {
        arabicMeaning = arMatch[1].trim();
      }
    }

    neueWoerterUndRedemittel.push({
      german: noun,
      article,
      ...(arabicMeaning ? { arabic: arabicMeaning } : {}),
      ...(matchingSentence ? { example: matchingSentence.slice(0, 160) } : {})
    });
  }

  // Extract explicit vocabulary notes from AI template sections like "Neue Wörter: der Bahnhof, die Fahrkarte"
  for (const note of labeledNotes) {
    if (/^(neue\s+wörter(?:\s+und\s+redemittel)?|wortschatz|vokabeln|vocabulary|redemittel)$/i.test(note.label)) {
      const parts = note.value.split(/[,;|•]+/).map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        const artMatch = /^(der|die|das)\s+([A-ZÄÖÜ][a-zäöüß]{2,24})(.*)$/i.exec(part);
        if (artMatch) {
          neueWoerterUndRedemittel.push({
            german: artMatch[2].trim(),
            article: artMatch[1].toLowerCase() as 'der' | 'die' | 'das'
          });
        } else if (/[A-Za-zÄÖÜäöüß]{3,}/.test(part)) {
          neueWoerterUndRedemittel.push({ german: part.slice(0, 100) });
        }
      }
    }
  }

  // Also extract explicitly introduced Redemittel / expressions (e.g., quotes „...“ or "...")
  const quoteRegex = /[„"«]([^„"»\n]{6,95})[“"»]/g;
  while ((m = quoteRegex.exec(combined)) !== null) {
    const phrase = m[1].trim();
    if (/[A-Za-zÄÖÜäöüß]{3,}/.test(phrase)) {
      neueWoerterUndRedemittel.push({
        german: phrase
      });
    }
  }

  // 3. Extract explicit Thema der Stunde (from explicit cue or AI Notes topic/summary header)
  let themaDerStunde = '';
  const explicitTopicNote = labeledNotes.find((n) =>
    /^(thema(?:\s+der\s+stunde)?|topic|subject)$/i.test(n.label)
  );
  const explicitTopicMatch =
    /(?:thema(?:\s+der\s+stunde|\s+heute)?|heute\s+(?:lernen|besprechen|behandeln|machen)\s+wir|wir\s+sprechen\s+heute\s+über|درس\s+اليوم|موضوع\s+الحصة)[:\s\-]+([^\n.!?]{4,110})/i.exec(
      combined
    );
  if (explicitTopicNote && explicitTopicNote.value.length >= 4) {
    themaDerStunde = explicitTopicNote.value.split(/(?<=[.!?])\s+/)[0].slice(0, 120);
  } else if (explicitTopicMatch) {
    themaDerStunde = explicitTopicMatch[1].trim();
  } else if (grammatik.length > 0 && neueWoerterUndRedemittel.length > 0) {
    const topVocab = neueWoerterUndRedemittel
      .slice(0, 2)
      .map((v) => (v.article ? `${v.article} ${v.german}` : v.german))
      .join(', ');
    themaDerStunde = `${grammatik[0].topic} & Wortschatz (${topVocab})`;
  } else if (grammatik.length > 0) {
    themaDerStunde = grammatik.map((g) => g.topic).slice(0, 2).join(' / ');
  } else if (options.lessonTitle && options.lessonTitle.trim()) {
    themaDerStunde = `${options.lessonTitle.trim()}: ${(allSentences[0] || '').slice(0, 80)}`.replace(/:\s*$/, '');
  } else {
    themaDerStunde = (allSentences[0] || '').slice(0, 110);
  }

  // 4. Extract Behandelte Inhalte (what was covered across Transcript + AI Notes in Part 1 & Part 2)
  const behandelteInhalte: string[] = [];
  for (const note of labeledNotes) {
    if (
      /^(summary|zusammenfassung|overview|überblick|(?:behandelte\s+)?inhalte?|topics?|key\s*takeaways?|highlight)$/i.test(
        note.label
      )
    ) {
      const cleanVal = note.value.replace(/^(?:highlight)[:\s]+/i, '').trim();
      if (cleanVal.length >= 5) {
        behandelteInhalte.push(cleanVal.slice(0, 180));
      }
    }
  }
  for (const s of allSentences) {
    if (
      /\b(heute|thema|lernen|besprechen|wiederholen|erklären|wortschatz|grammatik|dialog|text|teil\s*1|teil\s*2)\b/i.test(
        s
      )
    ) {
      behandelteInhalte.push(s.slice(0, 180));
    }
  }
  if (grammatik.length > 0) {
    for (const g of grammatik) {
      behandelteInhalte.push(`Grammatikschwerpunkt: ${g.topic}`);
    }
  }
  if (behandelteInhalte.length === 0 && allSentences.length > 0) {
    behandelteInhalte.push(...allSentences.slice(0, 4).map((s) => s.slice(0, 180)));
  }

  // 5. Extract Beispiele (important German example sentences from Transcript + AI Notes)
  const beispiele: string[] = [];
  for (const note of labeledNotes) {
    if (/^(beispiele?|examples?)$/i.test(note.label)) {
      const cleaned = note.value.trim();
      if (cleaned.length >= 6) beispiele.push(cleaned.slice(0, 180));
    }
  }
  for (const s of allSentences) {
    if (
      /\b(beispiel|zum\s+beispiel|z\.?\s*b\.?|satz|ich\s+kaufe|ich\s+fahre|ich\s+gehe|ich\s+habe|ich\s+bin|ich\s+stehe|ich\s+muss|ich\s+kann|wir\s+gehen|er\s+hat)\b/i.test(
        s
      )
    ) {
      const cleanedExample = s
        .replace(/^(?:zum\s+beispiel|beispiel|z\.?\s*b\.?)[:\s,\-]*/i, '')
        .trim();
      if (cleanedExample.length >= 6) {
        beispiele.push(cleanedExample.slice(0, 180));
      }
    }
  }
  for (const v of neueWoerterUndRedemittel) {
    if (v.example && beispiele.length < 10) {
      beispiele.push(v.example);
    }
  }

  // 6. Extract Übungen und Aktivitäten (from Transcript + AI Notes)
  const uebungenUndAktivitaeten: string[] = [];
  for (const note of labeledNotes) {
    if (/^(übung(?:en)?(?:\s+und\s+aktivitäten)?|aktivitäten|exercises?|activities?)$/i.test(note.label)) {
      if (note.value.length >= 4) uebungenUndAktivitaeten.push(note.value.slice(0, 180));
    }
  }
  for (const s of allSentences) {
    if (
      /\b(übung\w*|aufgabe\w*|seite\s*\d+|dialog\w*|rollenspiel\w*|lesen|vorlesen|hören|schreiben|ergänzen|beantworten|kursbuch|arbeitsbuch|hausaufgabe\w*)\b/i.test(
        s
      )
    ) {
      uebungenUndAktivitaeten.push(s.slice(0, 180));
    }
  }

  // 7. Extract Offene Punkte (Transcript questions/review cues + Grain ai_action_items)
  const offenePunkte: string[] = [
    ...(options.part1ActionItems || []),
    ...(options.part2ActionItems || [])
  ]
    .map((item) => String(item || '').trim())
    .filter((item) => item.length >= 3)
    .map((item) => item.slice(0, 180));

  for (const note of labeledNotes) {
    if (/^(offene\s*punkte?|offener\s*punkt|action\s*items?|next\s*steps?)$/i.test(note.label)) {
      if (note.value.length >= 3) offenePunkte.push(note.value.slice(0, 180));
    }
  }
  for (const s of allSentences) {
    if (
      /\b(nächst\w*\s+(?:mal|stunde|woche)|noch\s+unklar|schwierig\w*|wiederholen\s+wir|offen\w*\s+punkt\w*|frage\w*\s+zu|nicht\s+ganz\s+klar|müssen\s+wir\s+noch\s+üben|مراجعة|غير\s+واضح|الحصة\s+القادمة)\b/i.test(
        s
      ) ||
      s.endsWith('?')
    ) {
      offenePunkte.push(s.slice(0, 180));
    }
  }

  return deduplicateGermanExtractedContent({
    themaDerStunde,
    behandelteInhalte,
    neueWoerterUndRedemittel,
    grammatik,
    beispiele,
    uebungenUndAktivitaeten,
    offenePunkte,
    formattedLessonSummaryDe: ''
  });
}

/**
 * Extracts structured 7-section German lesson content for a lesson from its matched Part 1 and (optional) Part 2
 * Grain recordings using Grain's native Transcript and AI Notes (`ai_summary`, `ai_template_sections`, `highlights`, `ai_action_items`).
 * - Works 100% independently of Gemini (zero GEMINI_API_KEY or external AI endpoint dependency).
 * - Always combines both Transcript and AI Notes whenever available, and supports AI Notes-only extraction when transcripts are unavailable.
 * - Combines Part 1 and Part 2 into one coherent summary and removes duplicates.
 * - Includes both transcript and AI Notes content in `sourceContentFingerprint` so late-arriving AI Notes trigger reprocessing.
 * - If both transcript and AI Notes are unavailable, returns `transcriptStatus: 'transcript_unavailable'` without generating fabricated content.
 */
export async function extractStructuredLessonContentForLesson(options: {
  lesson: Lesson;
  recordings?: GrainDiscoveredRecording[];
  providedPart1Transcript?: string;
  providedPart2Transcript?: string;
  providedPart1AiNotes?: string;
  providedPart2AiNotes?: string;
}): Promise<GrainExtractedLessonContent> {
  const { lesson } = options;
  const discovered = options.recordings || loadDiscoveredGrainRecordings({ includeRemoved: true });

  const part1Id =
    lesson.grainMeta?.recordingId ||
    discovered.find(
      (r) =>
        (r.confirmedLessonId === lesson.id || r.suggestedLessonId === lesson.id) &&
        r.detectedPartSlot !== 'part2'
    )?.id ||
    '';

  const part2Id =
    lesson.grainMeta?.recordingIdPart2 ||
    discovered.find(
      (r) =>
        (r.confirmedLessonId === lesson.id || r.suggestedLessonId === lesson.id) &&
        r.detectedPartSlot === 'part2' &&
        r.id !== part1Id
    )?.id ||
    '';

  const sourceRecordingIds = [part1Id, part2Id].filter(Boolean);
  const nowIso = new Date().toISOString();

  const fetchSourcesForRecording = async (
    recId: string,
    providedTranscript?: string,
    providedAiNotes?: string
  ): Promise<{
    transcriptText: string;
    aiNotesText: string;
    actionItems: string[];
    hasTranscript: boolean;
    hasAiNotes: boolean;
  }> => {
    let transcriptText = '';
    if (typeof providedTranscript === 'string') {
      transcriptText = providedTranscript.trim();
    } else if (recId) {
      const tr = await getTranscriptEphemerally(recId);
      if (tr.available && tr.plainText.trim()) {
        transcriptText = tr.plainText.trim();
      }
    }

    let aiNotesText = '';
    let actionItems: string[] = [];
    if (typeof providedAiNotes === 'string') {
      aiNotesText = providedAiNotes.trim();
    } else if (recId) {
      const cachedRec = discovered.find((r) => r.id === recId);
      // Skip remote recording_details fetch if both transcript/notes were explicitly supplied in unit tests without live bridge
      const detailRes = await executeScopedGrainOperation({
        operation: 'recording_details',
        recordingId: recId,
        payload: {
          include: {
            ai_summary: true,
            ai_template_sections: { format: 'json' },
            highlights: true,
            ai_action_items: true
          }
        }
      });
      const detailData = detailRes.ok ? detailRes.data : null;
      const notesBundle = extractGrainAiNotesFromRecordingDetails(
        detailData,
        typeof providedTranscript === 'string' ? undefined : cachedRec?.aiSummaryExcerpt
      );
      aiNotesText = notesBundle.combinedNotesText;
      actionItems = notesBundle.actionItemLines;
    }

    return {
      transcriptText,
      aiNotesText,
      actionItems,
      hasTranscript: transcriptText.length > 0,
      hasAiNotes: aiNotesText.length > 0
    };
  };

  const part1Sources = await fetchSourcesForRecording(
    part1Id,
    options.providedPart1Transcript,
    options.providedPart1AiNotes
  );
  const hasPart2Inputs = Boolean(
    part2Id ||
      (typeof options.providedPart2Transcript === 'string' && options.providedPart2Transcript.trim()) ||
      (typeof options.providedPart2AiNotes === 'string' && options.providedPart2AiNotes.trim())
  );
  const part2Sources = hasPart2Inputs
    ? await fetchSourcesForRecording(
        part2Id,
        options.providedPart2Transcript,
        options.providedPart2AiNotes
      )
    : {
        transcriptText: '',
        aiNotesText: '',
        actionItems: [],
        hasTranscript: false,
        hasAiNotes: false
      };

  const hasPart1Content = part1Sources.hasTranscript || part1Sources.hasAiNotes;
  const hasPart2Content = part2Sources.hasTranscript || part2Sources.hasAiNotes;

  const fingerprintItems: Array<{ recordingId: string; text: string }> = [
    ...(part1Id || hasPart1Content
      ? [
          { recordingId: `${part1Id || 'part1'}:transcript`, text: part1Sources.transcriptText },
          { recordingId: `${part1Id || 'part1'}:ai_notes`, text: part1Sources.aiNotesText }
        ]
      : []),
    ...(part2Id || hasPart2Content
      ? [
          { recordingId: `${part2Id || 'part2'}:transcript`, text: part2Sources.transcriptText },
          { recordingId: `${part2Id || 'part2'}:ai_notes`, text: part2Sources.aiNotesText }
        ]
      : [])
  ];
  const fingerprint = computeGrainLessonSourceFingerprint(
    fingerprintItems.length > 0
      ? fingerprintItems
      : sourceRecordingIds.map((id) => ({ recordingId: id, text: '' }))
  );

  // Requirement 6 & 8: If neither transcript nor AI Notes are available, return clear unavailable status and DO NOT fabricate content!
  if (!hasPart1Content && !hasPart2Content) {
    return {
      themaDerStunde: '',
      behandelteInhalte: [],
      neueWoerterUndRedemittel: [],
      grammatik: [],
      beispiele: [],
      uebungenUndAktivitaeten: [],
      offenePunkte: [],
      formattedLessonSummaryDe: '',
      sourceRecordingIds,
      sourceContentFingerprint: fingerprint,
      extractedAt: nowIso,
      origin: 'grain_transcript_and_notes',
      sourceKinds: [],
      transcriptStatus: 'transcript_unavailable',
      partCount: part2Id ? 2 : 1,
      teacherEdited: false
    };
  }

  const extractedCore = extractStructuredGermanLessonContentDeterministically({
    lessonTitle: lesson.title || lesson.groupName,
    part1Text: part1Sources.transcriptText,
    part2Text: part2Sources.transcriptText,
    part1AiNotes: part1Sources.aiNotesText,
    part2AiNotes: part2Sources.aiNotesText,
    part1ActionItems: part1Sources.actionItems,
    part2ActionItems: part2Sources.actionItems
  });

  const sourceKinds: Array<'transcript' | 'ai_notes'> = [];
  if (part1Sources.hasTranscript || part2Sources.hasTranscript) {
    sourceKinds.push('transcript');
  }
  if (part1Sources.hasAiNotes || part2Sources.hasAiNotes) {
    sourceKinds.push('ai_notes');
  }

  const transcriptStatus: GrainExtractedLessonContent['transcriptStatus'] =
    part2Id && (!hasPart1Content || !hasPart2Content) ? 'partial_transcript' : 'complete';

  return {
    ...extractedCore,
    sourceRecordingIds,
    sourceContentFingerprint: fingerprint,
    extractedAt: nowIso,
    origin: 'grain_transcript_and_notes',
    sourceKinds,
    transcriptStatus,
    partCount: hasPart1Content && hasPart2Content ? 2 : 1,
    teacherEdited: false
  };
}

/**
 * Requirement 5: Automatic Saving Inside Glück (`applyExtractedLessonContentToLesson`).
 * - Saves extracted lesson content inside `lesson.grainMeta.extractedLessonContent` and internal `lesson.whatWasTaught`.
 * - Avoids duplicate work on repeated syncs via `sourceContentFingerprint`.
 * - Reprocesses automatically when Part 2 or a newly completed transcript arrives.
 * - Preserves teacher edits: if the teacher already edited the lesson summary (`teacherEdited: true` or manually written `lesson.whatWasTaught`),
 *   never overwrites the teacher's text; stores the new extraction in `pendingUpdatedExtraction` instead.
 * - Never auto-publishes to parent reports, homework, grades, certificates, or Lernstudio.
 */
export function applyExtractedLessonContentToLesson(
  lesson: Lesson,
  extracted: GrainExtractedLessonContent
): {
  updated: boolean;
  preservedTeacherEdits: boolean;
  lessonPatch: Partial<Lesson>;
} {
  const existingMeta = lesson.grainMeta;
  const existingExtracted = existingMeta?.extractedLessonContent;
  const currentStatuses = new Set<GrainWorkflowStatusBadge>(existingMeta?.workflowStatuses || []);

  if (extracted.transcriptStatus === 'transcript_unavailable') {
    currentStatuses.add('transcript_unavailable');
    const nextExtracted: GrainExtractedLessonContent = existingExtracted && existingExtracted.transcriptStatus !== 'transcript_unavailable'
      ? existingExtracted
      : extracted;

    const nextMeta: GrainLessonMetadata = {
      ...(existingMeta || {
        recordingId: extracted.sourceRecordingIds[0] || 'unlinked',
        recordingTitle: lesson.title || 'Grain Recording',
        startTimestamp: new Date().toISOString(),
        durationMinutes: lesson.duration || 60,
        recordingUrl: lesson.recordingLink || 'https://grain.com/app/recordings/unlinked',
        source: 'zoom',
        matchingStatus: 'confirmed',
        confirmedLessonId: lesson.id,
        lastSyncedAt: new Date().toISOString()
      }),
      extractedLessonContent: nextExtracted,
      workflowStatuses: Array.from(currentStatuses)
    };

    const patch: Partial<Lesson> = {
      grainMeta: nextMeta,
      ...(lesson.report ? { report: { ...lesson.report, grainMeta: nextMeta } } : {})
    };
    assertLessonAttendanceUnchanged(lesson, patch);
    return {
      updated: true,
      preservedTeacherEdits: Boolean(existingExtracted?.teacherEdited),
      lessonPatch: patch
    };
  }

  // Idempotency guard: if identical source fingerprint was already processed (or already queued in pendingUpdatedExtraction), do not duplicate
  if (
    existingExtracted &&
    ((existingExtracted.sourceContentFingerprint === extracted.sourceContentFingerprint &&
      existingExtracted.transcriptStatus === extracted.transcriptStatus) ||
      existingExtracted.pendingUpdatedExtraction?.sourceContentFingerprint ===
        extracted.sourceContentFingerprint)
  ) {
    return {
      updated: false,
      preservedTeacherEdits: Boolean(existingExtracted.teacherEdited),
      lessonPatch: {}
    };
  }

  currentStatuses.delete('transcript_unavailable');
  currentStatuses.add('lesson_content_extracted');

  const existingWhatWasTaught = String(lesson.whatWasTaught || '').trim();
  const previousAutoFormatted = String(existingExtracted?.formattedLessonSummaryDe || '').trim();
  const hasTeacherEditedSummary =
    Boolean(existingExtracted?.teacherEdited) ||
    existingExtracted?.origin === 'teacher_edited' ||
    Boolean(existingWhatWasTaught && existingWhatWasTaught !== previousAutoFormatted);

  if (hasTeacherEditedSummary) {
    // Preserve teacher's edited summary and store the newly arrived extraction in `pendingUpdatedExtraction`
    const preservedContent: GrainExtractedLessonContent = existingExtracted
      ? {
          ...existingExtracted,
          teacherEdited: true,
          origin: 'teacher_edited',
          pendingUpdatedExtraction: {
            themaDerStunde: extracted.themaDerStunde,
            behandelteInhalte: extracted.behandelteInhalte,
            neueWoerterUndRedemittel: extracted.neueWoerterUndRedemittel,
            grammatik: extracted.grammatik,
            beispiele: extracted.beispiele,
            uebungenUndAktivitaeten: extracted.uebungenUndAktivitaeten,
            offenePunkte: extracted.offenePunkte,
            formattedLessonSummaryDe: extracted.formattedLessonSummaryDe,
            sourceRecordingIds: extracted.sourceRecordingIds,
            sourceContentFingerprint: extracted.sourceContentFingerprint,
            extractedAt: extracted.extractedAt
          }
        }
      : {
          ...extracted,
          formattedLessonSummaryDe: existingWhatWasTaught,
          teacherEdited: true,
          origin: 'teacher_edited',
          teacherEditedAt: new Date().toISOString(),
          pendingUpdatedExtraction: {
            themaDerStunde: extracted.themaDerStunde,
            behandelteInhalte: extracted.behandelteInhalte,
            neueWoerterUndRedemittel: extracted.neueWoerterUndRedemittel,
            grammatik: extracted.grammatik,
            beispiele: extracted.beispiele,
            uebungenUndAktivitaeten: extracted.uebungenUndAktivitaeten,
            offenePunkte: extracted.offenePunkte,
            formattedLessonSummaryDe: extracted.formattedLessonSummaryDe,
            sourceRecordingIds: extracted.sourceRecordingIds,
            sourceContentFingerprint: extracted.sourceContentFingerprint,
            extractedAt: extracted.extractedAt
          }
        };

    const nextMeta: GrainLessonMetadata = {
      ...(existingMeta || {
        recordingId: extracted.sourceRecordingIds[0] || 'unlinked',
        recordingTitle: lesson.title || 'Grain Recording',
        startTimestamp: new Date().toISOString(),
        durationMinutes: lesson.duration || 60,
        recordingUrl: lesson.recordingLink || 'https://grain.com/app/recordings/unlinked',
        source: 'zoom',
        matchingStatus: 'confirmed',
        confirmedLessonId: lesson.id,
        lastSyncedAt: new Date().toISOString()
      }),
      extractedLessonContent: preservedContent,
      workflowStatuses: Array.from(currentStatuses)
    };

    const patch: Partial<Lesson> = {
      grainMeta: nextMeta,
      ...(lesson.report ? { report: { ...lesson.report, grainMeta: nextMeta } } : {})
    };
    assertLessonAttendanceUnchanged(lesson, patch);
    return {
      updated: true,
      preservedTeacherEdits: true,
      lessonPatch: patch
    };
  }

  // Not teacher-edited: save extracted 7-section summary into lesson.grainMeta and internal lesson.whatWasTaught
  const nextMeta: GrainLessonMetadata = {
    ...(existingMeta || {
      recordingId: extracted.sourceRecordingIds[0] || 'unlinked',
      recordingTitle: lesson.title || 'Grain Recording',
      startTimestamp: new Date().toISOString(),
      durationMinutes: lesson.duration || 60,
      recordingUrl: lesson.recordingLink || 'https://grain.com/app/recordings/unlinked',
      source: 'zoom',
      matchingStatus: 'confirmed',
      confirmedLessonId: lesson.id,
      lastSyncedAt: new Date().toISOString()
    }),
    extractedLessonContent: extracted,
    workflowStatuses: Array.from(currentStatuses)
  };

  const patch: Partial<Lesson> = {
    whatWasTaught: extracted.formattedLessonSummaryDe,
    ...(!lesson.topic && extracted.themaDerStunde ? { topic: extracted.themaDerStunde } : {}),
    grainMeta: nextMeta,
    ...(lesson.report
      ? {
          report: {
            ...lesson.report,
            grainMeta: nextMeta
          }
        }
      : {})
  };

  assertLessonAttendanceUnchanged(lesson, patch);
  return {
    updated: true,
    preservedTeacherEdits: false,
    lessonPatch: patch
  };
}

/**
 * Requirement 5: Teacher editing of extracted lesson content.
 * Marks the content as `'teacher_edited'` (`teacherEdited: true`) so future syncs never overwrite it.
 */
export function saveTeacherEditedGrainLessonContent(
  lesson: Lesson,
  edited: Partial<GrainExtractedLessonContentCore> & { customFormattedSummary?: string }
): Partial<Lesson> {
  const existing = lesson.grainMeta?.extractedLessonContent;
  const baseCore: GrainExtractedLessonContentCore = {
    themaDerStunde:
      edited.themaDerStunde !== undefined
        ? edited.themaDerStunde
        : existing?.themaDerStunde || lesson.topic || '',
    behandelteInhalte:
      edited.behandelteInhalte !== undefined
        ? edited.behandelteInhalte
        : existing?.behandelteInhalte || [],
    neueWoerterUndRedemittel:
      edited.neueWoerterUndRedemittel !== undefined
        ? edited.neueWoerterUndRedemittel
        : existing?.neueWoerterUndRedemittel || [],
    grammatik: edited.grammatik !== undefined ? edited.grammatik : existing?.grammatik || [],
    beispiele: edited.beispiele !== undefined ? edited.beispiele : existing?.beispiele || [],
    uebungenUndAktivitaeten:
      edited.uebungenUndAktivitaeten !== undefined
        ? edited.uebungenUndAktivitaeten
        : existing?.uebungenUndAktivitaeten || [],
    offenePunkte:
      edited.offenePunkte !== undefined ? edited.offenePunkte : existing?.offenePunkte || [],
    formattedLessonSummaryDe: ''
  };

  const deduped = deduplicateGermanExtractedContent(baseCore);
  const finalFormatted =
    typeof edited.customFormattedSummary === 'string' && edited.customFormattedSummary.trim()
      ? redactGrainSecrets(edited.customFormattedSummary.trim())
      : deduped.formattedLessonSummaryDe;

  const nowIso = new Date().toISOString();
  const nextExtracted: GrainExtractedLessonContent = {
    ...deduped,
    formattedLessonSummaryDe: finalFormatted,
    sourceRecordingIds: existing?.sourceRecordingIds || [lesson.grainMeta?.recordingId || ''].filter(Boolean),
    sourceContentFingerprint: existing?.sourceContentFingerprint || `teacher_edit_${nowIso}`,
    extractedAt: existing?.extractedAt || nowIso,
    origin: 'teacher_edited',
    transcriptStatus: existing?.transcriptStatus || 'complete',
    partCount: existing?.partCount || (lesson.grainMeta?.recordingIdPart2 ? 2 : 1),
    teacherEdited: true,
    teacherEditedAt: nowIso,
    pendingUpdatedExtraction: undefined
  };

  const nextMeta: GrainLessonMetadata = {
    ...(lesson.grainMeta || {
      recordingId: 'teacher_edited',
      recordingTitle: lesson.title || 'Lesson',
      startTimestamp: nowIso,
      durationMinutes: lesson.duration || 60,
      recordingUrl: lesson.recordingLink || 'https://grain.com/app/recordings/manual',
      source: 'zoom',
      matchingStatus: 'confirmed',
      confirmedLessonId: lesson.id,
      lastSyncedAt: nowIso
    }),
    extractedLessonContent: nextExtracted
  };

  const patch: Partial<Lesson> = {
    whatWasTaught: finalFormatted,
    ...(deduped.themaDerStunde ? { topic: deduped.themaDerStunde } : {}),
    grainMeta: nextMeta,
    ...(lesson.report ? { report: { ...lesson.report, grainMeta: nextMeta } } : {})
  };

  assertLessonAttendanceUnchanged(lesson, patch);
  return patch;
}

/**
 * Allows the teacher to accept or merge a `pendingUpdatedExtraction` (for example after Part 2 arrives)
 * while retaining teacher-approved control.
 */
export function acceptPendingUpdatedLessonExtraction(lesson: Lesson): Partial<Lesson> {
  const existing = lesson.grainMeta?.extractedLessonContent;
  const pending = existing?.pendingUpdatedExtraction;
  if (!existing || !pending) return {};

  const nowIso = new Date().toISOString();
  const nextExtracted: GrainExtractedLessonContent = {
    ...pending,
    origin: 'teacher_edited',
    transcriptStatus: 'complete',
    partCount: pending.sourceRecordingIds.length >= 2 ? 2 : 1,
    teacherEdited: true,
    teacherEditedAt: nowIso,
    pendingUpdatedExtraction: undefined
  };

  const nextMeta: GrainLessonMetadata = {
    ...lesson.grainMeta!,
    extractedLessonContent: nextExtracted
  };

  const patch: Partial<Lesson> = {
    whatWasTaught: pending.formattedLessonSummaryDe,
    ...(pending.themaDerStunde ? { topic: pending.themaDerStunde } : {}),
    grainMeta: nextMeta,
    ...(lesson.report ? { report: { ...lesson.report, grainMeta: nextMeta } } : {})
  };
  assertLessonAttendanceUnchanged(lesson, patch);
  return patch;
}

/**
 * Applies automatic matching and two-part pairing across discovered recordings and lessons:
 * - Automatically attaches unambiguous `'automatically_matched'` Part 1 (`recordingLink`) and Part 2 (`recordingLink2`) links.
 * - Handles reverse import order (if Part 2 arrived in an earlier sync and was temporarily placed in `recordingLink`,
 *   and Part 1 arrives ~40-42m earlier on the same date/lesson with `recordingLink2` empty, shifts Part 2 to `recordingLink2`
 *   and places Part 1 in `recordingLink`).
 * - Never overwrites an unrelated existing recording link without explicit teacher confirmation (marks recording `'needs_confirmation'`).
 */
export function applyAutomaticGrainMatchesAndTwoPartPairs(options: {
  recordings: GrainDiscoveredRecording[];
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  learningRecords?: GrainGroupLearningRecord[];
  part2Config?: Partial<GrainPart2DetectionConfig>;
}): {
  recordings: GrainDiscoveredRecording[];
  updatedLessons: Lesson[];
  lessonPatches: Record<string, Partial<Lesson>>;
} {
  const cfg = normalizePart2DetectionConfig(options.part2Config);
  const learningRecords =
    options.learningRecords ||
    loadGrainGroupLearningRecords((options.groups || []).filter((g) => g && !g.deleted));

  // Step 1: Evaluate all recordings against current lessons
  const evaluated = (options.recordings || []).map((rec) =>
    evaluateRecordingMatchAgainstLessons(
      rec,
      options.lessons,
      options.groups,
      options.students,
      learningRecords
    )
  );

  // Step 2: Detect two-part pairs (~40-42 min gap, same date & lesson, independent-lesson conflict check)
  const pairedRecordings = detectGrainTwoPartRecordingPairs({
    recordings: evaluated,
    lessons: options.lessons,
    groups: options.groups,
    students: options.students,
    learningRecords,
    part2Config: cfg
  });

  const recById = new Map<string, GrainDiscoveredRecording>();
  for (const r of pairedRecordings) {
    recById.set(r.id, { ...r });
  }

  const lessonById = new Map<string, Lesson>();
  for (const l of options.lessons || []) {
    if (l) lessonById.set(l.id, { ...l });
  }

  const lessonPatches: Record<string, Partial<Lesson>> = {};

  // Group candidate automatic recordings by target lesson
  for (const lesson of options.lessons || []) {
    if (!lesson || lesson.deleted || lesson.status === 'cancelled') continue;

    let workingLesson = lessonById.get(lesson.id)!;
    let lessonModified = false;

    const autoRecordingsForLesson = Array.from(recById.values())
      .filter(
        (r) =>
          !r.removedFromLibrary &&
          (r.confirmedLessonId === lesson.id ||
            (r.suggestedLessonId === lesson.id && r.matchStatus === 'automatically_matched'))
      )
      .sort((a, b) => {
        const msA = Date.parse(a.startDatetime || '');
        const msB = Date.parse(b.startDatetime || '');
        if (Number.isFinite(msA) && Number.isFinite(msB) && msA !== msB) return msA - msB;
        return String(a.startDatetime || '').localeCompare(String(b.startDatetime || ''));
      });

    if (autoRecordingsForLesson.length === 0) continue;

    // Check reverse arrival order case:
    // If workingLesson currently has a single Grain recording in `recordingLink` that actually starts ~40-42m AFTER
    // a newly arrived recording in `autoRecordingsForLesson` on the same date, and `recordingLink2` is empty,
    // shift the later recording to `recordingLink2` and put the earlier recording in `recordingLink`!
    if (autoRecordingsForLesson.length >= 2) {
      const firstRec = autoRecordingsForLesson[0];
      const secondRec = autoRecordingsForLesson[1];
      const ms1 = Date.parse(firstRec.startDatetime);
      const ms2 = Date.parse(secondRec.startDatetime);
      const gap = Number.isFinite(ms1) && Number.isFinite(ms2) ? Math.round((ms2 - ms1) / 60000) : -1;

      const curR1 = (workingLesson.recordingLink || workingLesson.report?.recordingLink || '').trim();
      const curR2 = (workingLesson.recordingLink2 || workingLesson.report?.recordingLink2 || '').trim();

      if (
        gap >= cfg.minGapMinutes &&
        gap <= cfg.maxGapMinutes &&
        curR1 === secondRec.recordingUrl.trim() &&
        (!curR2 || curR2 === firstRec.recordingUrl.trim())
      ) {
        // Reorder so Part 1 is in recordingLink and Part 2 is in recordingLink2
        const share1 = firstRec.shareAccessClassification || 'unknown';
        const share2 = secondRec.shareAccessClassification || 'unknown';
        const statuses = Array.from(
          new Set<GrainWorkflowStatusBadge>([
            ...(workingLesson.grainMeta?.workflowStatuses || []),
            'automatically_matched',
            'part1_detected',
            'part2_detected'
          ])
        );
        const reorderedMeta: GrainLessonMetadata = {
          ...(workingLesson.grainMeta || {
            source: firstRec.sourcePlatform || 'zoom',
            matchingStatus: 'confirmed',
            confirmedLessonId: workingLesson.id,
            lastSyncedAt: new Date().toISOString()
          }),
          recordingId: firstRec.id,
          recordingTitle: firstRec.title,
          startTimestamp: firstRec.startDatetime,
          endTimestamp: firstRec.endDatetime,
          durationMinutes: firstRec.durationMinutes,
          recordingUrl: firstRec.recordingUrl.trim(),
          shareAccessClassification: share1,
          recordingIdPart2: secondRec.id,
          recordingTitlePart2: secondRec.title,
          startTimestampPart2: secondRec.startDatetime,
          endTimestampPart2: secondRec.endDatetime,
          durationMinutesPart2: secondRec.durationMinutes,
          recordingUrlPart2: secondRec.recordingUrl.trim(),
          shareAccessClassificationPart2: share2,
          part2StartGapMinutes: gap,
          matchedAutomatically: true,
          learnedRecurringRuleId:
            firstRec.learnedRecurringRuleId ||
            secondRec.learnedRecurringRuleId ||
            workingLesson.grainMeta?.learnedRecurringRuleId,
          workflowStatuses: statuses,
          groupId: workingLesson.groupId || workingLesson.grainMeta?.groupId,
          matchingStatus: 'confirmed',
          confirmedLessonId: workingLesson.id,
          lastSyncedAt: new Date().toISOString()
        };

        const reorderPatch: Partial<Lesson> = {
          recordingLink: firstRec.recordingUrl.trim(),
          recordingLink2: secondRec.recordingUrl.trim(),
          grainMeta: reorderedMeta,
          ...(workingLesson.report
            ? {
                report: {
                  ...workingLesson.report,
                  recordingLink: firstRec.recordingUrl.trim(),
                  recordingLink2: secondRec.recordingUrl.trim(),
                  grainMeta: reorderedMeta
                }
              }
            : {})
        };
        assertLessonAttendanceUnchanged(workingLesson, reorderPatch);
        workingLesson = { ...workingLesson, ...reorderPatch };
        lessonPatches[workingLesson.id] = { ...(lessonPatches[workingLesson.id] || {}), ...reorderPatch };
        lessonModified = true;

        recById.set(firstRec.id, {
          ...firstRec,
          confirmedLessonId: workingLesson.id,
          detectedPartSlot: 'part1',
          pairedRecordingId: secondRec.id,
          part2StartGapMinutes: gap
        });
        recById.set(secondRec.id, {
          ...secondRec,
          confirmedLessonId: workingLesson.id,
          detectedPartSlot: 'part2',
          pairedRecordingId: firstRec.id,
          part2StartGapMinutes: gap
        });
      }
    }

    for (const rec of autoRecordingsForLesson) {
      const currentRec = recById.get(rec.id)!;
      if (currentRec.confirmedLessonId === workingLesson.id) {
        continue;
      }

      const preferredSlot: 'recordingLink' | 'recordingLink2' =
        currentRec.detectedPartSlot === 'part2' ? 'recordingLink2' : 'recordingLink';

      const attachment = prepareConfirmedGrainLessonAttachment({
        lesson: workingLesson,
        recording: currentRec,
        preferredSlot,
        allowOverwrite: false,
        matchedAutomatically: true
      });

      if (attachment.requiresOverwriteConfirmation) {
        // Requirement 3: Never overwrite an existing recording link without explicit confirmation!
        const updatedStatuses = new Set<GrainWorkflowStatusBadge>(currentRec.workflowStatuses || []);
        updatedStatuses.delete('automatically_matched');
        updatedStatuses.add('needs_teacher_confirmation');
        recById.set(currentRec.id, {
          ...currentRec,
          matchStatus: 'needs_confirmation',
          workflowStatuses: Array.from(updatedStatuses),
          matchReasons: [
            `Target slot (${attachment.targetSlot}) already contains an existing recording link. Teacher confirmation required before overwriting.`,
            ...currentRec.matchReasons
          ]
        });
        continue;
      }

      workingLesson = { ...workingLesson, ...attachment.proposedLessonPatch };
      lessonPatches[workingLesson.id] = {
        ...(lessonPatches[workingLesson.id] || {}),
        ...attachment.proposedLessonPatch
      };
      lessonModified = true;

      const updatedStatuses = new Set<GrainWorkflowStatusBadge>(currentRec.workflowStatuses || []);
      updatedStatuses.add('automatically_matched');
      updatedStatuses.add(attachment.targetSlot === 'recordingLink2' ? 'part2_detected' : 'part1_detected');
      recById.set(currentRec.id, {
        ...currentRec,
        confirmedLessonId: workingLesson.id,
        matchStatus: 'automatically_matched',
        workflowStatuses: Array.from(updatedStatuses)
      });
    }

    if (lessonModified) {
      lessonById.set(workingLesson.id, workingLesson);
    }
  }

  return {
    recordings: Array.from(recById.values()),
    updatedLessons: Array.from(lessonById.values()),
    lessonPatches
  };
}

/**
 * Incremental synchronization of Grain recordings (Section 7 & Smart Recurring Matching Upgrade).
 * Retrieves recordings since last successful sync (or optional date filter),
 * handles pagination, deduplicates by recording ID, classifies public share access,
 * matches against lessons using Smart Group Learning, detects Part 1 / Part 2 pairs,
 * automatically links unambiguous recurring lessons, and extracts 7-section German lesson content.
 */
export async function syncGrainRecordingsIncrementally(options: {
  lessons: Lesson[];
  groups: Group[];
  students: Student[];
  afterDatetime?: string;
  beforeDatetime?: string;
  titleSearch?: string;
  maxPages?: number;
  part2Config?: Partial<GrainPart2DetectionConfig>;
  autoExtractContent?: boolean;
  onUpdateLesson?: (lessonId: string, patch: Partial<Lesson>) => void;
}): Promise<{
  success: boolean;
  recordings: GrainDiscoveredRecording[];
  newCount: number;
  lessonPatches?: Record<string, Partial<Lesson>>;
  autoMatchedLessonIds?: string[];
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
  const weeklySessions = await loadGroupWeeklySessions();
  const zoomHistory = await loadZoomMeetingHistory();
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
    const grainCalUid =
      typeof raw.calendar_event?.ical_uid === 'string'
        ? raw.calendar_event.ical_uid
        : typeof raw.calendar_event?.iCalUID === 'string'
        ? raw.calendar_event.iCalUID
        : typeof raw.calendar_event?.uid === 'string'
        ? raw.calendar_event.uid
        : undefined;

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
        zoomMeetingId: verifiedZoom?.meetingId,
        calendarEventTitle:
          typeof raw.calendar_event?.title === 'string' ? raw.calendar_event.title : undefined,
        calendarEventUid: grainCalUid,
        participantNames,
        hasAiSummary: Boolean(aiSummaryStr),
        aiSummaryExcerpt: aiSummaryStr ? aiSummaryStr.slice(0, 400) : prevRec?.aiSummaryExcerpt,
        importedAt: prevRec?.importedAt || nowIso,
        removedFromLibrary: Boolean(prevRec?.removedFromLibrary || removedSet.has(id))
      },
      options.lessons,
      options.groups,
      options.students,
      learningRecords,
      options.part2Config,
      weeklySessions,
      zoomHistory
    );

    existingById.set(id, evaluated);
  }

  // Apply automatic recurring matching and Part 1 + Part 2 pairing across all recordings
  const preAutoList = Array.from(existingById.values()).map((rec) => ({
    ...rec,
    importedAt: rec.importedAt || nowIso,
    removedFromLibrary: Boolean(rec.removedFromLibrary || removedSet.has(rec.id))
  }));

  const autoApplied = applyAutomaticGrainMatchesAndTwoPartPairs({
    recordings: preAutoList,
    lessons: options.lessons,
    groups: options.groups,
    students: options.students,
    learningRecords,
    part2Config: options.part2Config
  });

  const finalLessonPatches: Record<string, Partial<Lesson>> = { ...autoApplied.lessonPatches };
  const autoMatchedLessonIds = Object.keys(autoApplied.lessonPatches);

  // Also check already-linked lessons whose recordings appeared in this sync batch so late-arriving
  // Grain AI Notes or transcripts trigger reprocessing cleanly (fingerprint-idempotent & teacher-edit safe).
  const syncedRecordingIds = new Set(
    fetchedRaw
      .map((r: any) => (r && typeof r.id === 'string' ? r.id.trim() : ''))
      .filter(Boolean)
  );
  const candidateExtractionLessonIds = new Set<string>(autoMatchedLessonIds);
  for (const rec of autoApplied.recordings) {
    const linkedId = rec.confirmedLessonId;
    if (linkedId && syncedRecordingIds.has(rec.id)) {
      candidateExtractionLessonIds.add(linkedId);
    }
  }

  // Automatically extract 7-section German lesson content from Grain Transcript + AI Notes
  if (options.autoExtractContent !== false && candidateExtractionLessonIds.size > 0) {
    for (const lessonId of candidateExtractionLessonIds) {
      const updatedLesson = autoApplied.updatedLessons.find((l) => l.id === lessonId);
      if (!updatedLesson) continue;
      const extracted = await extractStructuredLessonContentForLesson({
        lesson: updatedLesson,
        recordings: autoApplied.recordings
      });
      const applied = applyExtractedLessonContentToLesson(updatedLesson, extracted);
      if (applied.updated) {
        finalLessonPatches[lessonId] = {
          ...(finalLessonPatches[lessonId] || {}),
          ...applied.lessonPatch
        };
      }
    }
  }

  // Notify caller (e.g. AppContext updateLesson) of any automatic lesson updates
  if (typeof options.onUpdateLesson === 'function') {
    for (const [lessonId, patch] of Object.entries(finalLessonPatches)) {
      options.onUpdateLesson(lessonId, patch);
    }
  }

  // Persist sanitized GrainRecordingMatch trace records (metadata-only, zero transcripts/secrets)
  try {
    const existingMatches = await loadGrainRecordingMatches();
    const matchMap = new Map<string, GrainRecordingMatch>();
    for (const m of existingMatches) {
      if (m && m.id) matchMap.set(m.id, m);
    }
    const nowMs = Date.now();
    for (const rec of autoApplied.recordings) {
      const targetLessonId = rec.confirmedLessonId || rec.suggestedLessonId;
      if (!targetLessonId) continue;
      const matchId = `grm_${rec.id}`;
      matchMap.set(matchId, {
        id: matchId,
        grainRecordingId: rec.id,
        grainRecordingTitle: redactGrainSecrets(rec.title).slice(0, 200),
        grainRecordingUrl: rec.recordingUrl,
        zoomMeetingId: extractNumericZoomMeetingId(rec.zoomMeetingUrl) || undefined,
        sessionId: rec.matchedSessionId || rec.evidence?.matchedSessionId,
        groupId: rec.matchedGroupId,
        lessonId: targetLessonId,
        matchTier: rec.matchTier || rec.evidence?.matchTier || 'date_and_session',
        confidenceScore: rec.confidenceScore || 0,
        confidenceLevel: rec.confidenceLevel || rec.evidence?.confidenceLevel || 'low',
        status: rec.confirmedLessonId
          ? rec.matchStatus === 'automatically_matched'
            ? 'auto_matched'
            : 'confirmed'
          : 'suggested',
        reasons: (rec.matchReasons || []).slice(0, 6),
        matchedAt: nowIso,
        updatedAt: nowMs,
        deleted: false
      });
    }
    await saveGrainRecordingMatches(Array.from(matchMap.values()));
  } catch {
    // Non-fatal match trace persistence
  }

  const mergedList = autoApplied.recordings.sort((a, b) =>
    (b.startDatetime || '').localeCompare(a.startDatetime || '')
  );

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
    newCount,
    lessonPatches: finalLessonPatches,
    autoMatchedLessonIds
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
 * Prepares a teacher-confirmed or automatic recurring recording link attachment for a specific Glück lesson.
 * Rule 2: Never modifies attendance.
 * Rule 5: Returns a proposed patch; requires explicit teacher confirmation if overwriting an existing link.
 * Part 2: Preserves `shareAccessClassification` and Part 1/Part 2 timestamps on `lesson.grainMeta`.
 */
export function prepareConfirmedGrainLessonAttachment(options: {
  lesson: Lesson;
  recording: GrainDiscoveredRecording;
  preferredSlot?: 'auto' | 'recordingLink' | 'recordingLink2';
  allowOverwrite?: boolean;
  matchedAutomatically?: boolean;
}): ConfirmGrainMatchResult {
  const {
    lesson,
    recording,
    preferredSlot = 'auto',
    allowOverwrite = false,
    matchedAutomatically = false
  } = options;
  const currentR1 = (lesson.recordingLink || lesson.report?.recordingLink || '').trim();
  const currentR2 = (lesson.recordingLink2 || lesson.report?.recordingLink2 || '').trim();
  const newUrl = recording.recordingUrl.trim();

  let targetSlot: 'recordingLink' | 'recordingLink2' = 'recordingLink';
  if (preferredSlot === 'recordingLink2') {
    targetSlot = 'recordingLink2';
  } else if (preferredSlot === 'recordingLink') {
    targetSlot = 'recordingLink';
  } else if (recording.detectedPartSlot === 'part2' && currentR1 && currentR1 !== newUrl) {
    targetSlot = 'recordingLink2';
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

  const statuses = new Set<GrainWorkflowStatusBadge>(lesson.grainMeta?.workflowStatuses || []);
  statuses.delete('needs_teacher_confirmation');
  if (matchedAutomatically || recording.matchStatus === 'automatically_matched') {
    statuses.add('automatically_matched');
  }
  statuses.add(targetSlot === 'recordingLink2' ? 'part2_detected' : 'part1_detected');

  // Compute gap minutes if attaching either part when the paired timestamp exists
  let computedGapMinutes = recording.part2StartGapMinutes ?? lesson.grainMeta?.part2StartGapMinutes;
  if (targetSlot === 'recordingLink2' && lesson.grainMeta?.startTimestamp) {
    const ms1 = Date.parse(lesson.grainMeta.startTimestamp);
    const ms2 = Date.parse(recording.startDatetime);
    if (Number.isFinite(ms1) && Number.isFinite(ms2)) {
      computedGapMinutes = Math.round((ms2 - ms1) / 60000);
    }
  } else if (targetSlot === 'recordingLink' && lesson.grainMeta?.startTimestampPart2) {
    const ms1 = Date.parse(recording.startDatetime);
    const ms2 = Date.parse(lesson.grainMeta.startTimestampPart2);
    if (Number.isFinite(ms1) && Number.isFinite(ms2) && ms2 > ms1) {
      computedGapMinutes = Math.round((ms2 - ms1) / 60000);
    }
  }

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
          startTimestampPart2: recording.startDatetime,
          endTimestampPart2: recording.endDatetime,
          durationMinutesPart2: recording.durationMinutes,
          recordingUrlPart2: newUrl,
          shareAccessClassificationPart2: shareClass
        }),
    ...(typeof computedGapMinutes === 'number' ? { part2StartGapMinutes: computedGapMinutes } : {}),
    groupId: lesson.groupId || lesson.grainMeta?.groupId,
    matchingStatus: 'confirmed',
    matchedAutomatically: Boolean(matchedAutomatically || lesson.grainMeta?.matchedAutomatically),
    learnedRecurringRuleId:
      recording.learnedRecurringRuleId ||
      recording.evidence?.learnedRecurringRuleId ||
      lesson.grainMeta?.learnedRecurringRuleId,
    workflowStatuses: Array.from(statuses),
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

/**
 * Requirement 6 & Test 11: Handles a teacher correction when a recording is reassigned
 * from a suggested or previously auto-matched lesson/group to a teacher-chosen lesson/group.
 * - Detaches the recording from `previousLesson` if it was linked there.
 * - Attaches the recording to `targetLesson`.
 * - Records permanent recurring group learning AND penalizes the rejected group/lesson so the mistake is not repeated.
 */
export function correctGrainRecordingAssignment(options: {
  recording: GrainDiscoveredRecording;
  targetLesson: Lesson;
  previousLesson?: Lesson | null;
  groups: Group[];
  students: Student[];
  preferredSlot?: 'auto' | 'recordingLink' | 'recordingLink2';
  allowOverwrite?: boolean;
}): {
  requiresOverwriteConfirmation: boolean;
  targetSlot: 'recordingLink' | 'recordingLink2';
  targetLessonPatch: Partial<Lesson>;
  previousLessonPatch?: Partial<Lesson>;
  updatedLearningRecords: GrainGroupLearningRecord[];
} {
  const {
    recording,
    targetLesson,
    previousLesson,
    groups,
    students,
    preferredSlot = 'auto',
    allowOverwrite = false
  } = options;

  const attachment = prepareConfirmedGrainLessonAttachment({
    lesson: targetLesson,
    recording,
    preferredSlot,
    allowOverwrite,
    matchedAutomatically: false
  });

  let previousLessonPatch: Partial<Lesson> | undefined;
  if (previousLesson && previousLesson.id !== targetLesson.id) {
    const recUrl = recording.recordingUrl.trim();
    const prevR1 = (previousLesson.recordingLink || previousLesson.report?.recordingLink || '').trim();
    const prevR2 = (previousLesson.recordingLink2 || previousLesson.report?.recordingLink2 || '').trim();
    if (prevR1 === recUrl || prevR2 === recUrl) {
      const nextPrevR1 = prevR1 === recUrl ? undefined : prevR1 || undefined;
      const nextPrevR2 = prevR2 === recUrl ? undefined : prevR2 || undefined;
      const nextPrevMeta =
        prevR1 === recUrl && !nextPrevR2
          ? undefined
          : previousLesson.grainMeta
          ? {
              ...previousLesson.grainMeta,
              ...(prevR2 === recUrl
                ? {
                    recordingIdPart2: undefined,
                    recordingTitlePart2: undefined,
                    recordingUrlPart2: undefined,
                    startTimestampPart2: undefined,
                    endTimestampPart2: undefined,
                    durationMinutesPart2: undefined,
                    shareAccessClassificationPart2: undefined,
                    part2StartGapMinutes: undefined
                  }
                : {})
            }
          : undefined;
      previousLessonPatch = {
        recordingLink: nextPrevR1,
        recordingLink2: nextPrevR2,
        grainMeta: nextPrevMeta,
        ...(previousLesson.report
          ? {
              report: {
                ...previousLesson.report,
                recordingLink: nextPrevR1,
                recordingLink2: nextPrevR2,
                grainMeta: nextPrevMeta
              }
            }
          : {})
      };
      assertLessonAttendanceUnchanged(previousLesson, previousLessonPatch);
    }
  }

  let updatedLearningRecords = loadGrainGroupLearningRecords(
    (groups || []).filter((g) => g && !g.deleted)
  );

  if (!attachment.requiresOverwriteConfirmation) {
    const rejectedGroupId =
      previousLesson?.groupId ||
      (recording.matchedGroupId && recording.matchedGroupId !== targetLesson.groupId
        ? recording.matchedGroupId
        : undefined);
    const rejectedLessonId =
      previousLesson?.id ||
      (recording.suggestedLessonId && recording.suggestedLessonId !== targetLesson.id
        ? recording.suggestedLessonId
        : undefined);

    recordConfirmedGrainGroupLearning({
      lesson: targetLesson,
      groups,
      recording,
      students,
      previousSuggestedGroupId: rejectedGroupId,
      previousSuggestedLessonId: rejectedLessonId
    });
    updatedLearningRecords = loadGrainGroupLearningRecords(
      (groups || []).filter((g) => g && !g.deleted)
    );
  }

  return {
    requiresOverwriteConfirmation: attachment.requiresOverwriteConfirmation,
    targetSlot: attachment.targetSlot,
    targetLessonPatch: attachment.proposedLessonPatch,
    previousLessonPatch,
    updatedLearningRecords
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
  'ai_template_sections',
  'highlights',
  'ai_action_items',
  'rawAiNotes',
  'grainApiToken',
  'grainPersonalAccessToken',
  'grainToken',
  'grainMasterKey',
  'grainSessionToken',
  'unreviewedAiAnalysis',
  'startUrl',
  'start_url',
  'zoomClientSecret',
  'clientSecret',
  'zoomAccessToken',
  'zoomAccountId',
  'zak'
]);

const VALID_SHARE_CLASSIFICATIONS = new Set<GrainShareAccessClassification>([
  'public_access_verified',
  'workspace_only',
  'restricted',
  'unknown',
  'link_unavailable'
]);

const VALID_WORKFLOW_STATUSES = new Set<GrainWorkflowStatusBadge>([
  'automatically_matched',
  'part1_detected',
  'part2_detected',
  'lesson_content_extracted',
  'transcript_unavailable',
  'needs_teacher_confirmation'
]);

function sanitizeExtractedLessonContent(raw: any): GrainExtractedLessonContent | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const core = deduplicateGermanExtractedContent({
    themaDerStunde: String(raw.themaDerStunde || ''),
    behandelteInhalte: Array.isArray(raw.behandelteInhalte) ? raw.behandelteInhalte : [],
    neueWoerterUndRedemittel: Array.isArray(raw.neueWoerterUndRedemittel) ? raw.neueWoerterUndRedemittel : [],
    grammatik: Array.isArray(raw.grammatik) ? raw.grammatik : [],
    beispiele: Array.isArray(raw.beispiele) ? raw.beispiele : [],
    uebungenUndAktivitaeten: Array.isArray(raw.uebungenUndAktivitaeten) ? raw.uebungenUndAktivitaeten : [],
    offenePunkte: Array.isArray(raw.offenePunkte) ? raw.offenePunkte : [],
    formattedLessonSummaryDe: ''
  });

  const formatted =
    typeof raw.formattedLessonSummaryDe === 'string' && raw.formattedLessonSummaryDe.trim()
      ? redactGrainSecrets(raw.formattedLessonSummaryDe.trim()).slice(0, 3500)
      : core.formattedLessonSummaryDe;

  let cleanPending: GrainExtractedLessonContent['pendingUpdatedExtraction'] | undefined;
  if (raw.pendingUpdatedExtraction && typeof raw.pendingUpdatedExtraction === 'object') {
    const pCore = deduplicateGermanExtractedContent({
      themaDerStunde: String(raw.pendingUpdatedExtraction.themaDerStunde || ''),
      behandelteInhalte: Array.isArray(raw.pendingUpdatedExtraction.behandelteInhalte)
        ? raw.pendingUpdatedExtraction.behandelteInhalte
        : [],
      neueWoerterUndRedemittel: Array.isArray(raw.pendingUpdatedExtraction.neueWoerterUndRedemittel)
        ? raw.pendingUpdatedExtraction.neueWoerterUndRedemittel
        : [],
      grammatik: Array.isArray(raw.pendingUpdatedExtraction.grammatik)
        ? raw.pendingUpdatedExtraction.grammatik
        : [],
      beispiele: Array.isArray(raw.pendingUpdatedExtraction.beispiele)
        ? raw.pendingUpdatedExtraction.beispiele
        : [],
      uebungenUndAktivitaeten: Array.isArray(raw.pendingUpdatedExtraction.uebungenUndAktivitaeten)
        ? raw.pendingUpdatedExtraction.uebungenUndAktivitaeten
        : [],
      offenePunkte: Array.isArray(raw.pendingUpdatedExtraction.offenePunkte)
        ? raw.pendingUpdatedExtraction.offenePunkte
        : [],
      formattedLessonSummaryDe: ''
    });
    cleanPending = {
      ...pCore,
      sourceRecordingIds: Array.isArray(raw.pendingUpdatedExtraction.sourceRecordingIds)
        ? raw.pendingUpdatedExtraction.sourceRecordingIds
            .map((id: any) => redactGrainSecrets(String(id || '').trim()).slice(0, 128))
            .filter(Boolean)
            .slice(0, 4)
        : [],
      sourceContentFingerprint: String(raw.pendingUpdatedExtraction.sourceContentFingerprint || '').slice(0, 180),
      extractedAt: String(raw.pendingUpdatedExtraction.extractedAt || new Date().toISOString())
    };
  }

  return {
    ...core,
    formattedLessonSummaryDe: formatted,
    sourceRecordingIds: Array.isArray(raw.sourceRecordingIds)
      ? raw.sourceRecordingIds
          .map((id: any) => redactGrainSecrets(String(id || '').trim()).slice(0, 128))
          .filter(Boolean)
          .slice(0, 4)
      : [],
    sourceContentFingerprint: String(raw.sourceContentFingerprint || '').slice(0, 180),
    extractedAt: String(raw.extractedAt || new Date().toISOString()),
    origin:
      raw.origin === 'teacher_edited' ||
      raw.origin === 'teacher_written' ||
      raw.origin === 'deterministic_transcript' ||
      raw.origin === 'ai_extracted' ||
      raw.origin === 'grain_transcript_and_notes'
        ? raw.origin
        : 'grain_transcript_and_notes',
    ...(Array.isArray(raw.sourceKinds)
      ? {
          sourceKinds: raw.sourceKinds.filter(
            (k: any): k is 'transcript' | 'ai_notes' => k === 'transcript' || k === 'ai_notes'
          )
        }
      : {}),
    transcriptStatus:
      raw.transcriptStatus === 'transcript_unavailable' || raw.transcriptStatus === 'partial_transcript'
        ? raw.transcriptStatus
        : 'complete',
    partCount: raw.partCount === 2 ? 2 : 1,
    teacherEdited: Boolean(raw.teacherEdited || raw.origin === 'teacher_edited'),
    ...(typeof raw.teacherEditedAt === 'string' ? { teacherEditedAt: raw.teacherEditedAt } : {}),
    ...(cleanPending ? { pendingUpdatedExtraction: cleanPending } : {})
  };
}

/**
 * Sanitizes a `GrainLessonMetadata` object before persisting, syncing (P2P/Firebase), or exporting to backup.
 * Ensures zero tokens, zero raw transcripts, and bounded compact strings.
 */
export function sanitizeGrainLessonMetadata(meta: any): GrainLessonMetadata | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const recordingId = String(meta.recordingId || '').trim();
  const recordingUrl = String(meta.recordingUrl || '').trim();
  if (!recordingId || !recordingUrl) return undefined;

  const cleanExtracted = sanitizeExtractedLessonContent(meta.extractedLessonContent);
  const cleanWorkflowStatuses = Array.isArray(meta.workflowStatuses)
    ? meta.workflowStatuses.filter((s: any): s is GrainWorkflowStatusBadge => VALID_WORKFLOW_STATUSES.has(s))
    : undefined;

  return {
    recordingId: redactGrainSecrets(recordingId).slice(0, 128),
    ...(meta.recordingIdPart2 ? { recordingIdPart2: redactGrainSecrets(meta.recordingIdPart2).slice(0, 128) } : {}),
    recordingTitle: redactGrainSecrets(meta.recordingTitle || 'Grain Recording').slice(0, 200),
    ...(meta.recordingTitlePart2 ? { recordingTitlePart2: redactGrainSecrets(meta.recordingTitlePart2).slice(0, 200) } : {}),
    startTimestamp: String(meta.startTimestamp || ''),
    ...(meta.endTimestamp ? { endTimestamp: String(meta.endTimestamp) } : {}),
    ...(meta.startTimestampPart2 ? { startTimestampPart2: String(meta.startTimestampPart2) } : {}),
    ...(meta.endTimestampPart2 ? { endTimestampPart2: String(meta.endTimestampPart2) } : {}),
    durationMinutes: Math.max(0, Number(meta.durationMinutes) || 0),
    ...(typeof meta.durationMinutesPart2 === 'number'
      ? { durationMinutesPart2: Math.max(0, Number(meta.durationMinutesPart2) || 0) }
      : {}),
    ...(typeof meta.part2StartGapMinutes === 'number'
      ? { part2StartGapMinutes: Math.round(Number(meta.part2StartGapMinutes)) }
      : {}),
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
    ...(typeof meta.matchedAutomatically === 'boolean' ? { matchedAutomatically: meta.matchedAutomatically } : {}),
    ...(typeof meta.learnedRecurringRuleId === 'string' && meta.learnedRecurringRuleId.trim()
      ? { learnedRecurringRuleId: redactGrainSecrets(meta.learnedRecurringRuleId.trim()).slice(0, 128) }
      : {}),
    ...(cleanWorkflowStatuses && cleanWorkflowStatuses.length > 0
      ? { workflowStatuses: cleanWorkflowStatuses }
      : {}),
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
    ...(cleanExtracted ? { extractedLessonContent: cleanExtracted } : {}),
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
      const cleanedGrain = v.includes('grain_pat_') ? redactGrainSecrets(v) : v;
      clone[k] = redactZoomSecrets(cleanedGrain);
    } else if (v && typeof v === 'object') {
      clone[k] = sanitizeEntityForGrainPrivacy(v);
    } else {
      clone[k] = v;
    }
  }
  return clone as T;
}


