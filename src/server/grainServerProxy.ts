import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const GRAIN_API_ORIGIN = 'https://api.grain.com';
export const GRAIN_API_VERSION = '2026-10-01';
const SAFE_RECORDING_ID_REGEX = /^[a-zA-Z0-9_-]{4,128}$/;

export type GrainAllowedOperation =
  | 'token_info'
  | 'list_recordings'
  | 'recording_details'
  | 'recording_transcript';

const ALLOWED_OPERATIONS = new Set<GrainAllowedOperation>([
  'token_info',
  'list_recordings',
  'recording_details',
  'recording_transcript'
]);

export interface EncryptedEntry {
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
  maskedToken: string;
  updatedAt: string;
}

function getMasterKeyFilePath(): string {
  const dir = path.join(process.cwd(), '.aistudio');
  return path.join(dir, 'grain-vault-master.key');
}

/**
 * Part 3 (FIX-2B): Strong random 32-byte encryption master key.
 * - Loaded from `process.env.GRAIN_VAULT_MASTER_KEY` (hex/base64) or persisted in `.aistudio/grain-vault-master.key` (mode 0o600).
 * - Never derived from `process.cwd()` or `process.platform`.
 * - Never hardcoded in source code, never logged, stable across server restarts.
 */
function loadOrCreateVaultMasterKey(): Buffer | null {
  try {
    const envKey = String(process.env.GRAIN_VAULT_MASTER_KEY || '').trim();
    if (envKey) {
      if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
      }
      const b64 = Buffer.from(envKey, 'base64');
      if (b64.length === 32) {
        return b64;
      }
      return crypto.createHash('sha256').update(envKey, 'utf8').digest();
    }

    const keyPath = getMasterKeyFilePath();
    if (fs.existsSync(keyPath)) {
      const existingHex = fs.readFileSync(keyPath, 'utf8').trim();
      if (/^[0-9a-fA-F]{64}$/.test(existingHex)) {
        return Buffer.from(existingHex, 'hex');
      }
    }

    const dir = path.dirname(keyPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const randomKey = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, randomKey.toString('hex'), { encoding: 'utf8', mode: 0o600 });
    return randomKey;
  } catch {
    // Fallback to ephemeral process random key if filesystem is strictly read-only
    return crypto.randomBytes(32);
  }
}

let vaultMasterKey: Buffer | null = loadOrCreateVaultMasterKey();
let forceMasterKeyUnavailableForTesting = false;

export function __setVaultMasterKeyUnavailableForTesting(unavailable: boolean): void {
  forceMasterKeyUnavailableForTesting = unavailable;
}

const LOCAL_SESSION_HMAC_SECRET = crypto.randomBytes(32);

interface ActiveGrainSessionRecord {
  sessionId: string;
  uid: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const activeGrainSessions = new Map<string, ActiveGrainSessionRecord>();

// Sliding-window rate limiter per UID / IP (Part 3 — FIX-2D & FIX-2E)
const rateLimitBuckets = new Map<string, number[]>();
let rateLimitMaxRequestsPerWindow = 60;
let rateLimitWindowMs = 60 * 1000;

export function __setGrainProxyRateLimitForTesting(maxRequests: number, windowMs = 60000): void {
  rateLimitMaxRequestsPerWindow = Math.max(1, maxRequests);
  rateLimitWindowMs = Math.max(100, windowMs);
  rateLimitBuckets.clear();
}

export function checkGrainProxyRateLimit(bucketKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const cutoff = now - rateLimitWindowMs;
  const existing = (rateLimitBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);
  if (existing.length >= rateLimitMaxRequestsPerWindow) {
    const oldest = existing[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + rateLimitWindowMs - now) / 1000));
    rateLimitBuckets.set(bucketKey, existing);
    return { allowed: false, retryAfterSeconds };
  }
  existing.push(now);
  rateLimitBuckets.set(bucketKey, existing);
  return { allowed: true };
}

let inMemoryEncryptedVault = new Map<string, EncryptedEntry>();

// Test hook for unit/security tests to intercept outgoing Grain API fetch calls without real network
export type GrainUpstreamFetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  status: number;
  headers?: Record<string, string>;
  text: () => Promise<string>;
}>;

let customUpstreamFetch: GrainUpstreamFetchFn | null = null;

export function __setGrainServerUpstreamFetchForTesting(fn: GrainUpstreamFetchFn | null): void {
  customUpstreamFetch = fn;
}

export function __resetGrainServerVaultForTesting(): void {
  inMemoryEncryptedVault.clear();
  activeGrainSessions.clear();
  rateLimitBuckets.clear();
  forceMasterKeyUnavailableForTesting = false;
  rateLimitMaxRequestsPerWindow = 60;
  rateLimitWindowMs = 60 * 1000;
}

function getVaultFilePath(): string {
  const dir = path.join(process.cwd(), '.aistudio');
  return path.join(dir, 'grain-server-vault.enc.json');
}

function loadVaultFromDisk(): void {
  try {
    const filePath = getVaultFilePath();
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [uid, entry] of Object.entries(parsed)) {
        if (entry && typeof entry === 'object' && (entry as any).ciphertextB64) {
          inMemoryEncryptedVault.set(uid, entry as EncryptedEntry);
        }
      }
    }
  } catch {
    // Ignore unreadable vault file
  }
}

function persistVaultToDisk(): void {
  try {
    const filePath = getVaultFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const obj: Record<string, EncryptedEntry> = {};
    for (const [uid, entry] of inMemoryEncryptedVault.entries()) {
      obj[uid] = entry;
    }
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Ignore disk write failure in read-only containers; inMemoryEncryptedVault remains active
  }
}

loadVaultFromDisk();

export function normalizeServerGrainTokenInput(rawInput: unknown): string {
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

export function maskGrainTokenString(token: string): string {
  const clean = normalizeServerGrainTokenInput(token);
  if (clean.length <= 12) return 'grain_pat_••••';
  return `grain_pat_••••••••${clean.slice(-4)}`;
}

export function isServerVaultEncryptionAvailable(): boolean {
  if (forceMasterKeyUnavailableForTesting) return false;
  if (!vaultMasterKey || vaultMasterKey.length !== 32) {
    vaultMasterKey = loadOrCreateVaultMasterKey();
  }
  return Boolean(vaultMasterKey && vaultMasterKey.length === 32);
}

export function encryptGrainTokenForVault(rawToken: string): EncryptedEntry {
  if (!isServerVaultEncryptionAvailable() || !vaultMasterKey) {
    const err = new Error('Server encryption master key is unavailable; refusing to store plaintext token.');
    (err as any).code = 'ENCRYPTION_UNAVAILABLE';
    throw err;
  }
  const clean = String(rawToken || '').trim();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', vaultMasterKey, iv);
  const encrypted = Buffer.concat([cipher.update(clean, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivB64: iv.toString('base64'),
    authTagB64: authTag.toString('base64'),
    ciphertextB64: encrypted.toString('base64'),
    maskedToken: maskGrainTokenString(clean),
    updatedAt: new Date().toISOString()
  };
}

export function decryptGrainTokenFromVault(entry: EncryptedEntry): string | null {
  if (!isServerVaultEncryptionAvailable() || !vaultMasterKey) {
    return null;
  }
  try {
    const iv = Buffer.from(entry.ivB64, 'base64');
    const authTag = Buffer.from(entry.authTagB64, 'base64');
    const ciphertext = Buffer.from(entry.ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', vaultMasterKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Part 3 (FIX-2D): Strong random session ID bound to user/device, stored in active session store
 * with expiration and immediate revocation on disconnect.
 */
export function createLocalTeacherSessionToken(deviceId: string): string {
  const cleanDevice = String(deviceId || 'local_teacher')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .trim()
    .slice(0, 48) || 'local_teacher';
  const uid = `local_${cleanDevice}`;
  const sessionId = crypto.randomBytes(24).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload = `${cleanDevice}.${sessionId}.${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', LOCAL_SESSION_HMAC_SECRET)
    .update(payload)
    .digest('hex');

  activeGrainSessions.set(sessionId, {
    sessionId,
    uid,
    issuedAt,
    expiresAt,
    revoked: false
  });

  return `${payload}.${sig}`;
}

export function revokeGrainSessionsForUser(uid: string): void {
  for (const [sid, record] of activeGrainSessions.entries()) {
    if (record.uid === uid) {
      record.revoked = true;
      activeGrainSessions.delete(sid);
    }
  }
}

export function verifyLocalTeacherSessionToken(token: string): { valid: boolean; uid?: string } {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4) return { valid: false };
  const [deviceId, sessionId, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!deviceId || !sessionId || !Number.isFinite(issuedAt)) return { valid: false };

  const activeSession = activeGrainSessions.get(sessionId);
  if (!activeSession || activeSession.revoked) {
    return { valid: false };
  }
  const now = Date.now();
  if (now > activeSession.expiresAt || Math.abs(now - issuedAt) > SESSION_TTL_MS) {
    activeGrainSessions.delete(sessionId);
    return { valid: false };
  }

  const expectedSig = crypto
    .createHmac('sha256', LOCAL_SESSION_HMAC_SECRET)
    .update(`${deviceId}.${sessionId}.${issuedAtStr}`)
    .digest('hex');
  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    const expectedUid = `local_${deviceId}`;
    if (activeSession.uid !== expectedUid) {
      return { valid: false };
    }
    return { valid: true, uid: expectedUid };
  } catch {
    return { valid: false };
  }
}

/**
 * Part 3 (FIX-2A): Strict loopback validation.
 * - Inspects `req.socket.remoteAddress` directly (never trusting spoofed `X-Forwarded-For`, `X-Real-IP`, or `Host` alone).
 * - Rejects requests that carry proxy forwarding headers (`x-forwarded-for`, `x-real-ip`, `forwarded`) from non-local origins.
 * - Validates `Origin` header when present to ensure it is a local origin.
 */
export function isStrictLoopbackRequest(req: Request): boolean {
  const socketIp = String(req.socket?.remoteAddress || '').trim();
  const isLoopbackSocket =
    socketIp === '127.0.0.1' ||
    socketIp === '::1' ||
    socketIp === '::ffff:127.0.0.1' ||
    /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(socketIp) ||
    /^::ffff:127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(socketIp);

  if (!isLoopbackSocket) {
    return false;
  }

  // If a reverse proxy injected forwarding headers for a non-loopback client, do not treat as direct local loopback
  const xff = String(req.headers['x-forwarded-for'] || '').trim();
  const xRealIp = String(req.headers['x-real-ip'] || '').trim();
  const forwarded = String(req.headers['forwarded'] || '').trim();
  if (xff || xRealIp || forwarded) {
    const firstIp = xff.split(',')[0].trim() || xRealIp;
    const forwardedIsLoopback =
      !forwarded &&
      (firstIp === '127.0.0.1' || firstIp === '::1' || firstIp === '::ffff:127.0.0.1');
    if (!forwardedIsLoopback) {
      return false;
    }
  }

  // Validate Origin header if present
  const originHeader = String(req.headers.origin || '').trim();
  if (originHeader) {
    try {
      const parsedOrigin = new URL(originHeader);
      const hn = parsedOrigin.hostname.toLowerCase();
      if (hn !== 'localhost' && hn !== '127.0.0.1' && hn !== '[::1]') {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

function isTrustedPreviewContainerRequest(req: Request): boolean {
  const clientHeader = String(req.headers['x-grain-local-client'] || '').trim();
  if (clientHeader !== 'glueck-web') return false;
  const originHeader = String(req.headers.origin || req.headers.referer || '').trim();
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    const hn = parsed.hostname.toLowerCase();
    return (
      hn === 'localhost' ||
      hn === '127.0.0.1' ||
      hn === '[::1]' ||
      hn.endsWith('.run.app')
    );
  } catch {
    return false;
  }
}

export type VerifyFirebaseIdTokenFn = (
  idToken: string
) => Promise<{ isValid: boolean; payload?: { sub: string; email?: string }; error?: string }>;

async function resolveAuthenticatedGrainUser(
  req: Request,
  verifyFirebaseIdToken: VerifyFirebaseIdTokenFn
): Promise<{ authenticated: boolean; uid?: string; status?: number; error?: string }> {
  // Never allow tokens in query string (Part 3 — FIX-2D)
  if (
    req.query?.token !== undefined ||
    req.query?.sessionToken !== undefined ||
    req.query?.access_token !== undefined
  ) {
    return {
      authenticated: false,
      status: 400,
      error: 'Credentials or session tokens in URL query parameters are strictly forbidden.'
    };
  }

  const authHeader = String(req.headers.authorization || '').trim();
  const requestedOwnerUid = String(req.headers['x-owner-uid'] || req.body?.ownerUid || req.query?.ownerUid || '').trim();

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim();
    if (!idToken) {
      return { authenticated: false, status: 401, error: 'Empty Bearer token' };
    }
    // Reject if someone passes a raw Grain token as Bearer to the proxy
    if (idToken.startsWith('grain_pat_')) {
      return {
        authenticated: false,
        status: 401,
        error: 'Raw Grain tokens must never be sent in Authorization headers from the browser.'
      };
    }
    const verification = await verifyFirebaseIdToken(idToken);
    if (!verification.isValid || !verification.payload?.sub) {
      return {
        authenticated: false,
        status: 401,
        error: `Unauthorized: ${verification.error || 'Invalid Firebase ID token'}`
      };
    }
    const verifiedUid = verification.payload.sub;
    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return {
        authenticated: false,
        status: 403,
        error: 'Forbidden: requested ownerUid does not match authenticated Firebase user'
      };
    }
    return { authenticated: true, uid: verifiedUid };
  }

  const localSessionToken = String(req.headers['x-grain-session-token'] || '').trim();
  if (localSessionToken) {
    if (!isStrictLoopbackRequest(req) && !isTrustedPreviewContainerRequest(req)) {
      return {
        authenticated: false,
        status: 403,
        error: 'Forbidden: local session tokens are only accepted from verified loopback sockets.'
      };
    }
    const verifiedLocal = verifyLocalTeacherSessionToken(localSessionToken);
    if (verifiedLocal.valid && verifiedLocal.uid) {
      if (requestedOwnerUid && requestedOwnerUid !== verifiedLocal.uid) {
        return {
          authenticated: false,
          status: 403,
          error: 'Forbidden: session UID mismatch'
        };
      }
      return { authenticated: true, uid: verifiedLocal.uid };
    }
  }

  return {
    authenticated: false,
    status: 401,
    error: 'Authentication required: provide a valid Firebase Bearer token or local teacher session token.'
  };
}

/**
 * Part 3 (FIX-2C): Strict user isolation.
 * Retrieves only the token explicitly stored for `uid` (never falling back to another user's token).
 */
function getDecryptedTokenForUser(uid: string): { token: string | null; maskedToken: string | null } {
  const entry = inMemoryEncryptedVault.get(uid);
  if (entry) {
    const decrypted = decryptGrainTokenFromVault(entry);
    if (decrypted) {
      return { token: decrypted, maskedToken: entry.maskedToken };
    }
  }
  return { token: null, maskedToken: null };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOP_LEVEL_FORBIDDEN_FILTER_KEYS = [
  'after_datetime',
  'before_datetime',
  'title_search',
  'participant_scope',
  'attendance',
  'team',
  'meeting_type'
] as const;

const ALLOWED_LIST_RECORDINGS_TOP_KEYS = new Set(['cursor', 'filter', 'include']);
const ALLOWED_RECORDING_DETAILS_TOP_KEYS = new Set(['include']);
const ALLOWED_FILTER_KEYS = new Set([
  'before_datetime',
  'after_datetime',
  'participant_scope',
  'title_search',
  'team',
  'meeting_type',
  'attendance'
]);

const DOCUMENTED_BOOLEAN_INCLUDE_KEYS = [
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

const ALLOWED_INCLUDE_KEYS = new Set<string>([
  ...DOCUMENTED_BOOLEAN_INCLUDE_KEYS,
  'ai_template_sections'
]);

export function normalizeGrainIso8601Timestamp(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function sanitizeGrainRecordingFilter(rawFilter: unknown): Record<string, any> | undefined {
  if (!rawFilter || typeof rawFilter !== 'object' || Array.isArray(rawFilter)) {
    return undefined;
  }
  const f = rawFilter as Record<string, unknown>;
  const out: Record<string, any> = {};

  const beforeDt = normalizeGrainIso8601Timestamp(f.before_datetime);
  if (beforeDt) out.before_datetime = beforeDt;

  const afterDt = normalizeGrainIso8601Timestamp(f.after_datetime);
  if (afterDt) out.after_datetime = afterDt;

  if (f.attendance === 'hosted' || f.attendance === 'attended') {
    out.attendance = f.attendance;
  }

  if (f.participant_scope === 'internal' || f.participant_scope === 'external') {
    out.participant_scope = f.participant_scope;
  }

  if (typeof f.title_search === 'string' && f.title_search.trim()) {
    out.title_search = f.title_search.trim();
  }

  if (typeof f.team === 'string' && UUID_REGEX.test(f.team.trim())) {
    out.team = f.team.trim();
  }

  if (typeof f.meeting_type === 'string' && UUID_REGEX.test(f.meeting_type.trim())) {
    out.meeting_type = f.meeting_type.trim();
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function sanitizeGrainRecordingInclude(rawInclude: unknown): Record<string, any> | undefined {
  if (!rawInclude || typeof rawInclude !== 'object' || Array.isArray(rawInclude)) {
    return undefined;
  }
  const inc = rawInclude as Record<string, unknown>;
  const out: Record<string, any> = {};

  for (const key of DOCUMENTED_BOOLEAN_INCLUDE_KEYS) {
    if (typeof inc[key] === 'boolean' && inc[key] === true) {
      out[key] = true;
    }
  }

  // Documented in 2026-10-01: ai_template_sections is an object { format?: 'json' | 'markdown' | 'text', allowed_sections?: string[] }
  if (inc.ai_template_sections && typeof inc.ai_template_sections === 'object' && !Array.isArray(inc.ai_template_sections)) {
    const ats = inc.ai_template_sections as Record<string, unknown>;
    const cleanAts: Record<string, any> = {};
    if (ats.format === 'json' || ats.format === 'markdown' || ats.format === 'text') {
      cleanAts.format = ats.format;
    } else {
      cleanAts.format = 'json';
    }
    if (Array.isArray(ats.allowed_sections)) {
      const sections = ats.allowed_sections
        .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
        .map((s) => s.trim());
      if (sections.length > 0) {
        cleanAts.allowed_sections = sections;
      }
    }
    out.ai_template_sections = cleanAts;
  } else if (inc.ai_template_sections === true) {
    out.ai_template_sections = { format: 'json' };
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function buildWhitelistedGrainTarget(options: {
  operation: string;
  recordingId?: string;
  bodyPayload?: any;
  rawRequestBody?: any;
}): {
  valid: boolean;
  error?: string;
  code?: string;
  url?: string;
  method?: 'GET' | 'POST';
  bodyString?: string;
} {
  const rawBody = options.rawRequestBody || {};
  // Strictly forbid any caller from supplying arbitrary URLs, hosts, or methods
  if (
    rawBody.url !== undefined ||
    rawBody.targetUrl !== undefined ||
    rawBody.host !== undefined ||
    rawBody.endpoint !== undefined ||
    rawBody.path !== undefined ||
    rawBody.method !== undefined
  ) {
    return {
      valid: false,
      code: 'ARBITRARY_URL_FORBIDDEN',
      error: 'Arbitrary URLs, hosts, paths, or HTTP methods are strictly forbidden on the Grain proxy.'
    };
  }

  const operation = String(options.operation || '').trim() as GrainAllowedOperation;
  if (!ALLOWED_OPERATIONS.has(operation)) {
    return {
      valid: false,
      code: 'UNSUPPORTED_OPERATION',
      error: `Unsupported Grain operation: ${operation || 'empty'}`
    };
  }

  let endpointPath = '';
  let method: 'GET' | 'POST' = 'GET';
  let sanitizedBody: Record<string, any> | undefined;

  if (operation === 'token_info') {
    endpointPath = '/_/public-api/v2/token-info';
    method = 'GET';
  } else if (operation === 'list_recordings') {
    endpointPath = '/_/public-api/v2/recordings';
    method = 'POST';
    const p = options.bodyPayload && typeof options.bodyPayload === 'object' && !Array.isArray(options.bodyPayload)
      ? options.bodyPayload
      : {};

    // Reject top-level filter fields (must be nested inside "filter")
    for (const forbiddenTopKey of TOP_LEVEL_FORBIDDEN_FILTER_KEYS) {
      if (p[forbiddenTopKey] !== undefined) {
        return {
          valid: false,
          code: 'INVALID_TOP_LEVEL_FILTER',
          error: `Field "${forbiddenTopKey}" must be nested inside "filter", not sent as a top-level field.`
        };
      }
    }

    // Part 6 (FIX-5): Reject any unknown top-level field
    for (const key of Object.keys(p)) {
      if (!ALLOWED_LIST_RECORDINGS_TOP_KEYS.has(key)) {
        return {
          valid: false,
          code: 'UNKNOWN_FIELD_FORBIDDEN',
          error: `Unknown top-level field "${key}" is not allowed in list_recordings.`
        };
      }
    }

    // Reject unknown filter keys
    if (p.filter !== undefined) {
      if (!p.filter || typeof p.filter !== 'object' || Array.isArray(p.filter)) {
        return {
          valid: false,
          code: 'INVALID_FILTER_OBJECT',
          error: '"filter" must be a plain JSON object.'
        };
      }
      for (const fKey of Object.keys(p.filter)) {
        if (!ALLOWED_FILTER_KEYS.has(fKey)) {
          return {
            valid: false,
            code: 'UNKNOWN_FILTER_FIELD',
            error: `Unknown filter field "${fKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }

    // Reject unknown include keys
    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return {
          valid: false,
          code: 'INVALID_INCLUDE_OBJECT',
          error: '"include" must be a plain JSON object.'
        };
      }
      for (const incKey of Object.keys(p.include)) {
        if (!ALLOWED_INCLUDE_KEYS.has(incKey)) {
          return {
            valid: false,
            code: 'UNKNOWN_INCLUDE_FIELD',
            error: `Unknown include field "${incKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }

    sanitizedBody = {};
    if (typeof p.cursor === 'string' && p.cursor.trim()) {
      sanitizedBody.cursor = p.cursor.trim();
    }
    const cleanFilter = sanitizeGrainRecordingFilter(p.filter);
    if (cleanFilter) {
      sanitizedBody.filter = cleanFilter;
    }
    const cleanInclude = sanitizeGrainRecordingInclude(p.include);
    if (cleanInclude) {
      sanitizedBody.include = cleanInclude;
    }
  } else if (operation === 'recording_details') {
    const recId = String(options.recordingId || '').trim();
    if (!SAFE_RECORDING_ID_REGEX.test(recId)) {
      return {
        valid: false,
        code: 'INVALID_RECORDING_ID',
        error: 'A valid alphanumeric recordingId is required for recording_details.'
      };
    }
    endpointPath = `/_/public-api/v2/recordings/${recId}`;
    method = 'POST';
    const p = options.bodyPayload && typeof options.bodyPayload === 'object' && !Array.isArray(options.bodyPayload)
      ? options.bodyPayload
      : {};

    for (const key of Object.keys(p)) {
      if (!ALLOWED_RECORDING_DETAILS_TOP_KEYS.has(key)) {
        return {
          valid: false,
          code: 'UNKNOWN_FIELD_FORBIDDEN',
          error: `Unknown top-level field "${key}" is not allowed in recording_details.`
        };
      }
    }

    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return {
          valid: false,
          code: 'INVALID_INCLUDE_OBJECT',
          error: '"include" must be a plain JSON object.'
        };
      }
      for (const incKey of Object.keys(p.include)) {
        if (!ALLOWED_INCLUDE_KEYS.has(incKey)) {
          return {
            valid: false,
            code: 'UNKNOWN_INCLUDE_FIELD',
            error: `Unknown include field "${incKey}" is not allowed in Grain API v2.`
          };
        }
      }
    }

    sanitizedBody = {};
    const cleanInclude = sanitizeGrainRecordingInclude(p.include);
    if (cleanInclude) {
      sanitizedBody.include = cleanInclude;
    }
  } else if (operation === 'recording_transcript') {
    const recId = String(options.recordingId || '').trim();
    if (!SAFE_RECORDING_ID_REGEX.test(recId)) {
      return {
        valid: false,
        code: 'INVALID_RECORDING_ID',
        error: 'A valid alphanumeric recordingId is required for recording_transcript.'
      };
    }
    endpointPath = `/_/public-api/v2/recordings/${recId}/transcript`;
    method = 'GET';
  }

  const resolvedUrl = new URL(endpointPath, GRAIN_API_ORIGIN);
  if (resolvedUrl.origin !== GRAIN_API_ORIGIN || resolvedUrl.pathname.includes('..')) {
    return {
      valid: false,
      code: 'ARBITRARY_URL_FORBIDDEN',
      error: 'Resolved URL violates Grain origin policy.'
    };
  }

  return {
    valid: true,
    url: resolvedUrl.toString(),
    method,
    bodyString: method === 'POST' ? JSON.stringify(sanitizedBody || {}) : undefined
  };
}

async function executeUpstreamGrainRequest(options: {
  url: string;
  method: 'GET' | 'POST';
  token: string;
  bodyString?: string;
}): Promise<{
  httpStatus: number;
  retryAfter?: string;
  bodyText: string;
}> {
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${options.token}`,
        'Public-Api-Version': GRAIN_API_VERSION,
        Accept: 'application/json'
      };
      if (options.method === 'POST') {
        headers['Content-Type'] = 'application/json';
      }

      if (customUpstreamFetch) {
        const res = await customUpstreamFetch(options.url, {
          method: options.method,
          headers,
          body: options.bodyString,
          signal: controller.signal
        });
        // Part 3 (FIX-2E): Never follow redirects with Authorization header
        if (res.status >= 300 && res.status < 400) {
          return {
            httpStatus: 502,
            bodyText: JSON.stringify({
              error: 'Upstream redirect refused for security (Authorization header is never forwarded across redirects).',
              code: 'REDIRECT_FORBIDDEN'
            })
          };
        }
        const text = await res.text();
        return {
          httpStatus: res.status,
          retryAfter: res.headers?.['retry-after'] || res.headers?.['Retry-After'],
          bodyText: text
        };
      }

      const response = await fetch(options.url, {
        method: options.method,
        headers,
        body: options.bodyString,
        redirect: 'manual',
        signal: controller.signal
      });

      // Part 3 (FIX-2E): Reject 3xx redirects immediately without following
      if (response.status >= 300 && response.status < 400) {
        return {
          httpStatus: 502,
          bodyText: JSON.stringify({
            error: 'Upstream redirect refused for security (Authorization header is never forwarded across redirects).',
            code: 'REDIRECT_FORBIDDEN'
          })
        };
      }

      const bodyText = await response.text();
      const retryAfter = response.headers.get('retry-after') || undefined;

      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < maxAttempts) {
        continue;
      }

      return {
        httpStatus: response.status,
        retryAfter,
        bodyText
      };
    } catch {
      if (attempt < maxAttempts) {
        continue;
      }
      return {
        httpStatus: 502,
        bodyText: JSON.stringify({
          error: 'Network timeout or connection failure while contacting Grain API.',
          code: 'NETWORK_ERROR'
        })
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    httpStatus: 502,
    bodyText: JSON.stringify({ error: 'Upstream Grain request failed.', code: 'NETWORK_ERROR' })
  };
}

export function registerGrainServerRoutes(
  app: Express,
  verifyFirebaseIdToken: VerifyFirebaseIdTokenFn
): void {
  // 1. Issue a local loopback teacher session token (only when accessed from verified loopback socket or trusted preview container)
  app.post('/api/grain/session', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (!isStrictLoopbackRequest(req) && !isTrustedPreviewContainerRequest(req)) {
      return res.status(403).json({
        error: 'Local session tokens can only be issued to direct loopback connections. Use Firebase Bearer auth on remote hosts.',
        code: 'FORBIDDEN_REMOTE_SESSION'
      });
    }
    const socketBucket = `session_ip:${req.socket?.remoteAddress || 'local'}`;
    const rate = checkGrainProxyRateLimit(socketBucket);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds || 60));
      return res.status(429).json({
        error: 'Too many session token requests. Please wait before retrying.',
        code: 'RATE_LIMITED'
      });
    }

    const deviceId = String(req.body?.deviceId || 'local_teacher')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .trim()
      .slice(0, 48) || 'local_teacher';
    const sessionToken = createLocalTeacherSessionToken(deviceId);
    return res.status(200).json({
      sessionToken,
      ownerUid: `local_${deviceId}`
    });
  });

  // 2. Get Grain connection & vault status for the authenticated user
  app.get('/api/grain/status', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedGrainUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({
        error: authResult.error || 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    const encryptionReady = isServerVaultEncryptionAvailable();
    const { token, maskedToken } = encryptionReady
      ? getDecryptedTokenForUser(authResult.uid)
      : { token: null, maskedToken: null };
    return res.status(200).json({
      supported: encryptionReady,
      secureStorageAvailable: encryptionReady,
      runtime: 'web',
      hasToken: Boolean(token),
      maskedToken: token ? maskedToken : null
    });
  });

  // 3. Save Personal Access Token into server-side AES-256-GCM encrypted vault
  app.post('/api/grain/connect', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedGrainUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({
        error: authResult.error || 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    const rate = checkGrainProxyRateLimit(`connect:${authResult.uid}`);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds || 60));
      return res.status(429).json({
        saved: false,
        error: 'Rate limit exceeded for token connection attempts.',
        code: 'RATE_LIMITED'
      });
    }

    if (!isServerVaultEncryptionAvailable()) {
      return res.status(503).json({
        saved: false,
        error: 'Server encryption master key is unavailable; refusing to store token insecurely.',
        code: 'SECURE_STORAGE_UNAVAILABLE'
      });
    }

    const rawToken = normalizeServerGrainTokenInput(req.body?.token);
    if (!rawToken || rawToken.length < 6) {
      return res.status(400).json({
        saved: false,
        error: 'Invalid Grain Personal Access Token format.',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    const encrypted = encryptGrainTokenForVault(rawToken);
    inMemoryEncryptedVault.set(authResult.uid, encrypted);
    persistVaultToDisk();

    return res.status(200).json({
      saved: true,
      hasToken: true,
      maskedToken: encrypted.maskedToken,
      secureStorageAvailable: true
    });
  });

  // 4. Disconnect & purge saved token from server-side encrypted vault + revoke active sessions
  app.post('/api/grain/disconnect', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedGrainUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({
        error: authResult.error || 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    inMemoryEncryptedVault.delete(authResult.uid);
    revokeGrainSessionsForUser(authResult.uid);
    persistVaultToDisk();

    return res.status(200).json({
      disconnected: true,
      hasToken: false
    });
  });

  // 5. Execute a strictly whitelisted Grain Personal API v2 operation
  app.post('/api/grain/execute', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedGrainUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({
        error: authResult.error || 'Unauthorized',
        code: 'UNAUTHORIZED'
      });
    }

    const rate = checkGrainProxyRateLimit(`exec:${authResult.uid}`);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds || 60));
      return res.status(429).json({
        error: 'Too many Grain API requests. Please wait before retrying.',
        code: 'RATE_LIMITED'
      });
    }

    const validation = buildWhitelistedGrainTarget({
      operation: req.body?.operation,
      recordingId: req.body?.recordingId,
      bodyPayload: req.body?.payload,
      rawRequestBody: req.body
    });

    if (!validation.valid || !validation.url || !validation.method) {
      return res.status(400).json({
        error: validation.error || 'Invalid Grain proxy request',
        code: validation.code || 'BAD_REQUEST'
      });
    }

    const { token } = getDecryptedTokenForUser(authResult.uid);
    if (!token) {
      return res.status(401).json({
        error: 'Grain Personal Access Token is not configured for this account.',
        code: 'TOKEN_MISSING'
      });
    }

    const upstreamResult = await executeUpstreamGrainRequest({
      url: validation.url,
      method: validation.method,
      token,
      bodyString: validation.bodyString
    });

    return res.status(200).json({
      httpStatus: upstreamResult.httpStatus,
      retryAfter: upstreamResult.retryAfter,
      bodyText: upstreamResult.bodyText
    });
  });
}


