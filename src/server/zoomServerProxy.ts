import type { Express, Request, Response } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  isStrictLoopbackRequest,
  VerifyFirebaseIdTokenFn
} from './grainServerProxy';

export const ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token';
export const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';

export interface ZoomServerCredentialsPayload {
  accountId: string;
  clientId: string;
  clientSecret: string;
  defaultTimezone: string;
  planType?: 'basic' | 'licensed' | 'unknown';
  isBasicPlan?: boolean;
  hostEmail?: string;
  hostUserId?: string;
  updatedAt: string;
}

export interface EncryptedZoomVaultEntry {
  ivB64: string;
  authTagB64: string;
  ciphertextB64: string;
  maskedAccountId: string;
  maskedClientId: string;
  defaultTimezone: string;
  planType?: 'basic' | 'licensed' | 'unknown';
  isBasicPlan?: boolean;
  hostEmail?: string;
  updatedAt: string;
}

export type ZoomUpstreamFetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  }
) => Promise<{
  status: number;
  headers?: Record<string, string> | { get: (k: string) => string | null };
  text: () => Promise<string>;
}>;

let customZoomUpstreamFetch: ZoomUpstreamFetchFn | null = null;

export function __setZoomServerUpstreamFetchForTesting(fn: ZoomUpstreamFetchFn | null): void {
  customZoomUpstreamFetch = fn;
}

const LOCAL_ZOOM_SESSION_HMAC_SECRET = crypto.randomBytes(32);
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

interface ActiveZoomSessionRecord {
  sessionId: string;
  uid: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
}

const activeZoomSessions = new Map<string, ActiveZoomSessionRecord>();
const inMemoryZoomVault = new Map<string, EncryptedZoomVaultEntry>();
const cachedZoomAccessTokens = new Map<string, { accessToken: string; expiresAtMs: number }>();

// Per-UID sliding-window rate limiter & sequential queue support
const zoomRateLimitBuckets = new Map<string, number[]>();
const ZOOM_RATE_LIMIT_MAX = 40;
const ZOOM_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkZoomRateLimit(bucketKey: string): { allowed: boolean; retryAfterSeconds?: number } {
  const now = Date.now();
  const cutoff = now - ZOOM_RATE_LIMIT_WINDOW_MS;
  const existing = (zoomRateLimitBuckets.get(bucketKey) || []).filter((ts) => ts > cutoff);
  if (existing.length >= ZOOM_RATE_LIMIT_MAX) {
    const oldest = existing[0] || now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + ZOOM_RATE_LIMIT_WINDOW_MS - now) / 1000));
    zoomRateLimitBuckets.set(bucketKey, existing);
    return { allowed: false, retryAfterSeconds };
  }
  existing.push(now);
  zoomRateLimitBuckets.set(bucketKey, existing);
  return { allowed: true };
}

function getZoomMasterKeyFilePath(): string {
  return path.join(process.cwd(), '.aistudio', 'zoom-vault-master.key');
}

function getZoomVaultFilePath(): string {
  return path.join(process.cwd(), '.aistudio', 'zoom-server-vault.enc.json');
}

function loadOrCreateZoomMasterKey(): Buffer | null {
  try {
    const envKey = String(process.env.ZOOM_VAULT_MASTER_KEY || process.env.GRAIN_VAULT_MASTER_KEY || '').trim();
    if (envKey) {
      if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
        return Buffer.from(envKey, 'hex');
      }
      const b64 = Buffer.from(envKey, 'base64');
      if (b64.length === 32) return b64;
      return crypto.createHash('sha256').update(envKey, 'utf8').digest();
    }

    const keyPath = getZoomMasterKeyFilePath();
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
    return crypto.randomBytes(32);
  }
}

let zoomMasterKey: Buffer | null = loadOrCreateZoomMasterKey();
let forceZoomMasterKeyUnavailableForTesting = false;

export function __setZoomVaultMasterKeyUnavailableForTesting(unavailable: boolean): void {
  forceZoomMasterKeyUnavailableForTesting = unavailable;
}

export function __resetZoomServerVaultForTesting(): void {
  inMemoryZoomVault.clear();
  cachedZoomAccessTokens.clear();
  activeZoomSessions.clear();
  zoomRateLimitBuckets.clear();
  forceZoomMasterKeyUnavailableForTesting = false;
}

export function isZoomVaultEncryptionAvailable(): boolean {
  if (forceZoomMasterKeyUnavailableForTesting) return false;
  if (!zoomMasterKey || zoomMasterKey.length !== 32) {
    zoomMasterKey = loadOrCreateZoomMasterKey();
  }
  return Boolean(zoomMasterKey && zoomMasterKey.length === 32);
}

function maskCredentialValue(val: string): string {
  const clean = String(val || '').trim();
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}••••••••${clean.slice(-4)}`;
}

function encryptZoomPayloadForVault(payload: ZoomServerCredentialsPayload): EncryptedZoomVaultEntry {
  if (!isZoomVaultEncryptionAvailable() || !zoomMasterKey) {
    const err = new Error('Zoom server encryption master key unavailable.');
    (err as any).code = 'ENCRYPTION_UNAVAILABLE';
    throw err;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', zoomMasterKey, iv);
  const jsonText = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(jsonText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ivB64: iv.toString('base64'),
    authTagB64: authTag.toString('base64'),
    ciphertextB64: encrypted.toString('base64'),
    maskedAccountId: maskCredentialValue(payload.accountId),
    maskedClientId: maskCredentialValue(payload.clientId),
    defaultTimezone: payload.defaultTimezone || 'Africa/Cairo',
    planType: payload.planType || 'unknown',
    isBasicPlan: payload.isBasicPlan,
    hostEmail: payload.hostEmail,
    updatedAt: payload.updatedAt
  };
}

function decryptZoomPayloadFromVault(entry: EncryptedZoomVaultEntry): ZoomServerCredentialsPayload | null {
  if (!isZoomVaultEncryptionAvailable() || !zoomMasterKey) return null;
  try {
    const iv = Buffer.from(entry.ivB64, 'base64');
    const authTag = Buffer.from(entry.authTagB64, 'base64');
    const ciphertext = Buffer.from(entry.ciphertextB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', zoomMasterKey, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8')) as ZoomServerCredentialsPayload;
  } catch {
    return null;
  }
}

function loadZoomVaultFromDisk(): void {
  try {
    const filePath = getZoomVaultFilePath();
    if (!fs.existsSync(filePath)) return;
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [uid, entry] of Object.entries(parsed)) {
        if (entry && typeof entry === 'object' && (entry as any).ciphertextB64) {
          inMemoryZoomVault.set(uid, entry as EncryptedZoomVaultEntry);
        }
      }
    }
  } catch {
    // Ignore unreadable vault file
  }
}

function persistZoomVaultToDisk(): void {
  try {
    const filePath = getZoomVaultFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
    const obj: Record<string, EncryptedZoomVaultEntry> = {};
    for (const [uid, entry] of inMemoryZoomVault.entries()) {
      obj[uid] = entry;
    }
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Ignore read-only filesystem errors; inMemoryZoomVault keeps running
  }
}

loadZoomVaultFromDisk();

function isTrustedZoomPreviewRequest(req: Request): boolean {
  const clientHeader = String(req.headers['x-zoom-local-client'] || req.headers['x-grain-local-client'] || '').trim();
  if (clientHeader !== 'glueck-web') return false;
  const originHeader = String(req.headers.origin || req.headers.referer || '').trim();
  if (!originHeader) return true;
  try {
    const parsed = new URL(originHeader);
    const hn = parsed.hostname.toLowerCase();
    return hn === 'localhost' || hn === '127.0.0.1' || hn === '[::1]' || hn.endsWith('.run.app');
  } catch {
    return false;
  }
}

export function createLocalZoomSessionToken(deviceId: string): string {
  const cleanDevice =
    String(deviceId || 'local_teacher')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .trim()
      .slice(0, 48) || 'local_teacher';
  const uid = `local_${cleanDevice}`;
  const sessionId = crypto.randomBytes(24).toString('hex');
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload = `${cleanDevice}.${sessionId}.${issuedAt}`;
  const sig = crypto.createHmac('sha256', LOCAL_ZOOM_SESSION_HMAC_SECRET).update(payload).digest('hex');

  activeZoomSessions.set(sessionId, {
    sessionId,
    uid,
    issuedAt,
    expiresAt,
    revoked: false
  });
  return `${payload}.${sig}`;
}

function verifyLocalZoomSessionToken(token: string): { valid: boolean; uid?: string } {
  const parts = String(token || '').trim().split('.');
  if (parts.length !== 4) return { valid: false };
  const [deviceId, sessionId, issuedAtStr, sig] = parts;
  const issuedAt = Number(issuedAtStr);
  if (!deviceId || !sessionId || !Number.isFinite(issuedAt)) return { valid: false };

  const activeSession = activeZoomSessions.get(sessionId);
  if (!activeSession || activeSession.revoked) return { valid: false };

  const now = Date.now();
  if (now > activeSession.expiresAt || Math.abs(now - issuedAt) > SESSION_TTL_MS) {
    activeZoomSessions.delete(sessionId);
    return { valid: false };
  }

  const expectedSig = crypto
    .createHmac('sha256', LOCAL_ZOOM_SESSION_HMAC_SECRET)
    .update(`${deviceId}.${sessionId}.${issuedAtStr}`)
    .digest('hex');

  try {
    const a = Buffer.from(sig, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false };
    const expectedUid = `local_${deviceId}`;
    if (activeSession.uid !== expectedUid) return { valid: false };
    return { valid: true, uid: expectedUid };
  } catch {
    return { valid: false };
  }
}

async function resolveAuthenticatedZoomUser(
  req: Request,
  verifyFirebaseIdToken: VerifyFirebaseIdTokenFn
): Promise<{ authenticated: boolean; uid?: string; status?: number; error?: string }> {
  if (req.query?.clientSecret !== undefined || req.query?.access_token !== undefined) {
    return {
      authenticated: false,
      status: 400,
      error: 'Credentials in query parameters are strictly forbidden.'
    };
  }

  const authHeader = String(req.headers.authorization || '').trim();
  const requestedOwnerUid = String(req.headers['x-owner-uid'] || req.body?.ownerUid || '').trim();

  if (authHeader.startsWith('Bearer ')) {
    const idToken = authHeader.slice(7).trim();
    if (!idToken) return { authenticated: false, status: 401, error: 'Empty Bearer token' };
    const verification = await verifyFirebaseIdToken(idToken);
    if (!verification.isValid || !verification.payload?.sub) {
      return { authenticated: false, status: 401, error: verification.error || 'Invalid Firebase ID token' };
    }
    const verifiedUid = verification.payload.sub;
    if (requestedOwnerUid && requestedOwnerUid !== verifiedUid) {
      return { authenticated: false, status: 403, error: 'Forbidden: UID mismatch' };
    }
    return { authenticated: true, uid: verifiedUid };
  }

  const localSessionToken = String(
    req.headers['x-zoom-session-token'] || req.headers['x-grain-session-token'] || ''
  ).trim();
  if (localSessionToken) {
    if (!isStrictLoopbackRequest(req) && !isTrustedZoomPreviewRequest(req)) {
      return { authenticated: false, status: 403, error: 'Forbidden remote session token' };
    }
    const verifiedLocal = verifyLocalZoomSessionToken(localSessionToken);
    if (verifiedLocal.valid && verifiedLocal.uid) {
      return { authenticated: true, uid: verifiedLocal.uid };
    }
  }

  return {
    authenticated: false,
    status: 401,
    error: 'Authentication required for Zoom backend operations.'
  };
}

async function performZoomFetch(
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
  retriesLeft = 2
): Promise<{ status: number; bodyText: string; retryAfter?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const fetcher: ZoomUpstreamFetchFn = customZoomUpstreamFetch || (fetch as any);
    const resp = await fetcher(url, {
      ...init,
      signal: controller.signal
    });
    const text = await resp.text();
    let retryAfter: string | undefined;
    if (resp.headers) {
      retryAfter =
        typeof (resp.headers as any).get === 'function'
          ? (resp.headers as any).get('retry-after') || undefined
          : (resp.headers as Record<string, string>)['retry-after'];
    }

    if ((resp.status === 429 || resp.status >= 502) && retriesLeft > 0) {
      const waitMs = Math.min(3000, Math.max(400, (Number(retryAfter) || 1) * 1000));
      await new Promise((r) => setTimeout(r, waitMs));
      return performZoomFetch(url, init, retriesLeft - 1);
    }

    return { status: resp.status, bodyText: text, retryAfter };
  } catch (err: any) {
    if (retriesLeft > 0) {
      await new Promise((r) => setTimeout(r, 450));
      return performZoomFetch(url, init, retriesLeft - 1);
    }
    return {
      status: 502,
      bodyText: JSON.stringify({ message: err?.message || 'Zoom network timeout' })
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getZoomAccessTokenForUid(
  uid: string,
  creds: ZoomServerCredentialsPayload,
  forceRefresh = false
): Promise<{ ok: boolean; accessToken?: string; status?: number; error?: string }> {
  const cached = cachedZoomAccessTokens.get(uid);
  if (!forceRefresh && cached && cached.expiresAtMs > Date.now() + 5 * 60 * 1000) {
    return { ok: true, accessToken: cached.accessToken };
  }

  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
  const url = `${ZOOM_OAUTH_TOKEN_URL}?grant_type=account_credentials&account_id=${encodeURIComponent(
    creds.accountId
  )}`;

  const res = await performZoomFetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json'
    }
  });

  if (res.status < 200 || res.status >= 300) {
    let message = 'Zoom Server-to-Server OAuth authentication failed.';
    try {
      const parsed = JSON.parse(res.bodyText);
      message = parsed.reason || parsed.error_description || parsed.message || message;
    } catch {
      // Ignore non-JSON body
    }
    return { ok: false, status: res.status, error: message };
  }

  try {
    const parsed = JSON.parse(res.bodyText);
    const accessToken = String(parsed.access_token || '').trim();
    const expiresInSec = Math.max(120, Number(parsed.expires_in) || 3600);
    if (!accessToken) {
      return { ok: false, status: 502, error: 'Zoom OAuth response omitted access_token.' };
    }
    cachedZoomAccessTokens.set(uid, {
      accessToken,
      expiresAtMs: Date.now() + expiresInSec * 1000
    });
    return { ok: true, accessToken };
  } catch {
    return { ok: false, status: 502, error: 'Invalid JSON response from Zoom OAuth server.' };
  }
}

async function probeZoomHostUserProfile(
  accessToken: string
): Promise<{
  ok: boolean;
  email?: string;
  userId?: string;
  planType: 'basic' | 'licensed' | 'unknown';
  isBasicPlan: boolean;
  status: number;
  error?: string;
}> {
  const res = await performZoomFetch(`${ZOOM_API_BASE_URL}/users/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });

  if (res.status < 200 || res.status >= 300) {
    let msg = `Zoom /users/me check returned HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(res.bodyText);
      msg = parsed.message || msg;
    } catch {}
    return {
      ok: res.status === 400 || res.status === 403 ? false : false,
      planType: 'unknown',
      isBasicPlan: false,
      status: res.status,
      error: msg
    };
  }

  try {
    const u = JSON.parse(res.bodyText);
    // Zoom user.type: 1 = Basic (free 40m group cap), 2 = Licensed, 3 = On-Prem
    const userType = Number(u.type);
    const planType: 'basic' | 'licensed' | 'unknown' =
      userType === 1 ? 'basic' : userType >= 2 ? 'licensed' : 'unknown';
    return {
      ok: true,
      email: typeof u.email === 'string' ? u.email : undefined,
      userId: typeof u.id === 'string' ? u.id : undefined,
      planType,
      isBasicPlan: planType === 'basic',
      status: res.status
    };
  } catch {
    return {
      ok: true,
      planType: 'unknown',
      isBasicPlan: false,
      status: res.status
    };
  }
}

export function registerZoomServerRoutes(
  app: Express,
  verifyFirebaseIdToken: VerifyFirebaseIdTokenFn
): void {
  // 1. Issue local teacher session token for direct loopback / preview requests
  app.post('/api/zoom/session', (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    if (!isStrictLoopbackRequest(req) && !isTrustedZoomPreviewRequest(req)) {
      return res.status(403).json({ error: 'Forbidden remote session request', code: 'FORBIDDEN_REMOTE_SESSION' });
    }
    const bucket = `zoom_sess:${req.socket?.remoteAddress || 'local'}`;
    const rate = checkZoomRateLimit(bucket);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds || 30));
      return res.status(429).json({ error: 'Too many session requests', code: 'RATE_LIMITED' });
    }
    const deviceId = String(req.body?.deviceId || 'local_teacher')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 48) || 'local_teacher';
    const sessionToken = createLocalZoomSessionToken(deviceId);
    return res.status(200).json({ sessionToken, ownerUid: `local_${deviceId}` });
  });

  // 2. Get masked Zoom vault & plan status (NEVER returns clientSecret or OAuth tokens)
  app.get('/api/zoom/status', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }
    const vaultReady = isZoomVaultEncryptionAvailable();
    const entry = inMemoryZoomVault.get(authResult.uid);
    if (!entry) {
      return res.status(200).json({
        secureStorageAvailable: vaultReady,
        hasCredentials: false,
        defaultTimezone: 'Africa/Cairo',
        planType: 'unknown',
        isBasicPlan: false,
        maxMeetingMinutes: null
      });
    }

    return res.status(200).json({
      secureStorageAvailable: vaultReady,
      hasCredentials: true,
      maskedAccountId: entry.maskedAccountId,
      maskedClientId: entry.maskedClientId,
      defaultTimezone: entry.defaultTimezone || 'Africa/Cairo',
      planType: entry.planType || 'unknown',
      isBasicPlan: Boolean(entry.isBasicPlan),
      maxMeetingMinutes: entry.isBasicPlan ? 40 : null,
      hostEmail: entry.hostEmail || null,
      updatedAt: entry.updatedAt
    });
  });

  // 3. Connect & encrypt Zoom Server-to-Server OAuth credentials into backend vault
  app.post('/api/zoom/connect', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    if (!isZoomVaultEncryptionAvailable()) {
      return res.status(503).json({
        saved: false,
        error: 'Server encryption master key unavailable; refusing insecure storage.'
      });
    }

    const accountId = String(req.body?.accountId || '').trim();
    const clientId = String(req.body?.clientId || '').trim();
    const clientSecret = String(req.body?.clientSecret || '').trim();
    const defaultTimezone = String(req.body?.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';

    if (accountId.length < 6 || clientId.length < 6 || clientSecret.length < 8) {
      return res.status(400).json({
        saved: false,
        error: 'Account ID, Client ID, and Client Secret are required and appear too short.'
      });
    }

    const tempCreds: ZoomServerCredentialsPayload = {
      accountId,
      clientId,
      clientSecret,
      defaultTimezone,
      updatedAt: new Date().toISOString()
    };

    // Immediately verify OAuth credentials before saving cleanly
    cachedZoomAccessTokens.delete(authResult.uid);
    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, tempCreds, true);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(tokenRes.status === 400 || tokenRes.status === 401 ? 401 : 502).json({
        saved: false,
        connected: false,
        error: tokenRes.error || 'Zoom Server-to-Server OAuth verification failed.'
      });
    }

    const profileRes = await probeZoomHostUserProfile(tokenRes.accessToken);
    const finalCreds: ZoomServerCredentialsPayload = {
      ...tempCreds,
      planType: profileRes.ok ? profileRes.planType : 'unknown',
      isBasicPlan: profileRes.ok ? profileRes.isBasicPlan : false,
      hostEmail: profileRes.email,
      hostUserId: profileRes.userId
    };

    const encrypted = encryptZoomPayloadForVault(finalCreds);
    inMemoryZoomVault.set(authResult.uid, encrypted);
    persistZoomVaultToDisk();

    return res.status(200).json({
      saved: true,
      connected: true,
      maskedAccountId: encrypted.maskedAccountId,
      maskedClientId: encrypted.maskedClientId,
      defaultTimezone: finalCreds.defaultTimezone,
      planType: finalCreds.planType,
      isBasicPlan: Boolean(finalCreds.isBasicPlan),
      maxMeetingMinutes: finalCreds.isBasicPlan ? 40 : null,
      hostEmail: finalCreds.hostEmail || null
    });
  });

  // 4. Test saved Zoom S2S connection & inspect plan tier
  app.post('/api/zoom/test-connection', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const entry = inMemoryZoomVault.get(authResult.uid);
    if (!entry) {
      return res.status(404).json({ connected: false, error: 'Zoom credentials are not configured.' });
    }
    const creds = decryptZoomPayloadFromVault(entry);
    if (!creds) {
      return res.status(500).json({ connected: false, error: 'Failed to decrypt Zoom credentials.' });
    }

    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, creds, true);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(200).json({
        connected: false,
        error: tokenRes.error || 'OAuth token refresh failed.'
      });
    }

    const profileRes = await probeZoomHostUserProfile(tokenRes.accessToken);
    if (profileRes.ok) {
      const updatedCreds: ZoomServerCredentialsPayload = {
        ...creds,
        planType: profileRes.planType,
        isBasicPlan: profileRes.isBasicPlan,
        hostEmail: profileRes.email || creds.hostEmail,
        hostUserId: profileRes.userId || creds.hostUserId
      };
      inMemoryZoomVault.set(authResult.uid, encryptZoomPayloadForVault(updatedCreds));
      persistZoomVaultToDisk();
    }

    return res.status(200).json({
      connected: true,
      planType: profileRes.planType,
      isBasicPlan: profileRes.isBasicPlan,
      maxMeetingMinutes: profileRes.isBasicPlan ? 40 : null,
      hostEmail: profileRes.email || creds.hostEmail || null,
      defaultTimezone: creds.defaultTimezone || 'Africa/Cairo',
      profileCheckWarning: profileRes.ok ? null : profileRes.error
    });
  });

  // 5. Update non-secret Zoom settings (defaultTimezone)
  app.patch('/api/zoom/settings', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const defaultTimezone = String(req.body?.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const entry = inMemoryZoomVault.get(authResult.uid);
    if (!entry) {
      return res.status(200).json({ saved: true, defaultTimezone });
    }
    const creds = decryptZoomPayloadFromVault(entry);
    if (!creds) {
      return res.status(500).json({ saved: false, error: 'Failed to update settings in vault.' });
    }
    const nextCreds: ZoomServerCredentialsPayload = {
      ...creds,
      defaultTimezone,
      updatedAt: new Date().toISOString()
    };
    inMemoryZoomVault.set(authResult.uid, encryptZoomPayloadForVault(nextCreds));
    persistZoomVaultToDisk();
    return res.status(200).json({ saved: true, defaultTimezone });
  });

  // 6. Disconnect & purge encrypted Zoom credentials from vault
  app.post('/api/zoom/disconnect', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }
    inMemoryZoomVault.delete(authResult.uid);
    cachedZoomAccessTokens.delete(authResult.uid);
    persistZoomVaultToDisk();
    return res.status(200).json({ disconnected: true, hasCredentials: false });
  });

  // 7. Create recurring fixed-time Zoom meeting (type = 8)
  app.post('/api/zoom/meetings/create', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const rate = checkZoomRateLimit(`create:${authResult.uid}`);
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds || 30));
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait briefly.', code: 'RATE_LIMITED' });
    }

    const entry = inMemoryZoomVault.get(authResult.uid);
    const creds = entry ? decryptZoomPayloadFromVault(entry) : null;
    if (!creds) {
      return res.status(401).json({ error: 'Zoom credentials are not configured.', code: 'CREDENTIALS_MISSING' });
    }

    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, creds);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(502).json({ error: tokenRes.error || 'OAuth token unavailable.' });
    }

    const topic = String(req.body?.topic || '').trim().slice(0, 200);
    const startTime = String(req.body?.startTime || '').trim();
    const duration = Math.max(15, Math.min(300, Number(req.body?.duration) || 60));
    const timezone = String(req.body?.timezone || creds.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const weeklyDay = Math.max(1, Math.min(7, Number(req.body?.weeklyDay) || 2));
    const repeatInterval = Number(req.body?.repeatInterval) === 2 ? 2 : 1;

    if (!topic || !startTime) {
      return res.status(400).json({ error: 'topic and startTime are required to create a Zoom meeting.' });
    }

    const meetingBody = {
      topic,
      type: 8,
      start_time: startTime,
      duration,
      timezone,
      recurrence: {
        type: 2,
        repeat_interval: repeatInterval,
        weekly_days: String(weeklyDay),
        end_times: 50
      },
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: req.body?.waitingRoom !== false,
        auto_recording: req.body?.autoRecording === 'cloud' ? 'cloud' : 'none'
      }
    };

    const apiRes = await performZoomFetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(meetingBody)
    });

    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom API error (HTTP ${apiRes.status})`;
      try {
        const errObj = JSON.parse(apiRes.bodyText);
        msg = errObj.message || msg;
      } catch {}
      return res.status(apiRes.status === 429 ? 429 : 502).json({ error: msg });
    }

    try {
      const m = JSON.parse(apiRes.bodyText);
      return res.status(200).json({
        zoomMeetingId: String(m.id || ''),
        joinUrl: String(m.join_url || ''),
        startUrl: typeof m.start_url === 'string' ? m.start_url : undefined,
        meetingPasscode: typeof m.password === 'string' ? m.password : undefined,
        topic: String(m.topic || topic),
        timezone: String(m.timezone || timezone),
        hostEmail: creds.hostEmail || undefined,
        planWarning40Min: Boolean(creds.isBasicPlan && duration >= 41)
      });
    } catch {
      return res.status(502).json({ error: 'Invalid JSON returned by Zoom API.' });
    }
  });

  // 8. Update existing recurring Zoom meeting (PATCH /meetings/:meetingId)
  app.patch('/api/zoom/meetings/:meetingId', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const meetingId = String(req.params?.meetingId || '').replace(/[^0-9]/g, '');
    if (!meetingId || meetingId.length < 8) {
      return res.status(400).json({ error: 'Valid numeric Zoom meetingId is required.' });
    }

    const entry = inMemoryZoomVault.get(authResult.uid);
    const creds = entry ? decryptZoomPayloadFromVault(entry) : null;
    if (!creds) {
      return res.status(401).json({ error: 'Zoom credentials are not configured.' });
    }

    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, creds);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(502).json({ error: tokenRes.error || 'OAuth token unavailable.' });
    }

    const topic = String(req.body?.topic || '').trim().slice(0, 200);
    const startTime = String(req.body?.startTime || '').trim();
    const duration = Math.max(15, Math.min(300, Number(req.body?.duration) || 60));
    const timezone = String(req.body?.timezone || creds.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const weeklyDay = Math.max(1, Math.min(7, Number(req.body?.weeklyDay) || 2));
    const repeatInterval = Number(req.body?.repeatInterval) === 2 ? 2 : 1;

    const patchBody: Record<string, any> = {
      type: 8,
      duration,
      timezone,
      recurrence: {
        type: 2,
        repeat_interval: repeatInterval,
        weekly_days: String(weeklyDay),
        end_times: 50
      }
    };
    if (topic) patchBody.topic = topic;
    if (startTime) patchBody.start_time = startTime;

    const apiRes = await performZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(patchBody)
    });

    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom PATCH error (HTTP ${apiRes.status})`;
      try {
        const errObj = JSON.parse(apiRes.bodyText);
        msg = errObj.message || msg;
      } catch {}
      return res.status(apiRes.status === 404 ? 404 : 502).json({ error: msg, httpStatus: apiRes.status });
    }

    return res.status(200).json({
      updated: true,
      zoomMeetingId: meetingId,
      topic: topic || undefined,
      planWarning40Min: Boolean(creds.isBasicPlan && duration >= 41)
    });
  });

  // 9. Inspect meeting & obtain fresh short-lived host start_url on demand
  app.get('/api/zoom/meetings/:meetingId', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const meetingId = String(req.params?.meetingId || '').replace(/[^0-9]/g, '');
    if (!meetingId || meetingId.length < 8) {
      return res.status(400).json({ error: 'Valid numeric Zoom meetingId is required.' });
    }

    const entry = inMemoryZoomVault.get(authResult.uid);
    const creds = entry ? decryptZoomPayloadFromVault(entry) : null;
    if (!creds) {
      return res.status(401).json({ error: 'Zoom credentials are not configured.' });
    }

    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, creds);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(502).json({ error: tokenRes.error || 'OAuth token unavailable.' });
    }

    const apiRes = await performZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        Accept: 'application/json'
      }
    });

    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom inspect error (HTTP ${apiRes.status})`;
      try {
        const errObj = JSON.parse(apiRes.bodyText);
        msg = errObj.message || msg;
      } catch {}
      return res.status(apiRes.status === 404 ? 404 : 502).json({ error: msg, exists: apiRes.status !== 404 });
    }

    try {
      const m = JSON.parse(apiRes.bodyText);
      return res.status(200).json({
        exists: true,
        zoomMeetingId: String(m.id || meetingId),
        topic: String(m.topic || ''),
        joinUrl: String(m.join_url || ''),
        startUrl: typeof m.start_url === 'string' ? m.start_url : undefined,
        meetingPasscode: typeof m.password === 'string' ? m.password : undefined,
        timezone: typeof m.timezone === 'string' ? m.timezone : undefined,
        status: typeof m.status === 'string' ? m.status : 'waiting'
      });
    } catch {
      return res.status(502).json({ error: 'Invalid JSON returned from Zoom.' });
    }
  });

  // 10. Delete Zoom meeting (only when teacher explicitly requests deletion)
  app.delete('/api/zoom/meetings/:meetingId', async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    const authResult = await resolveAuthenticatedZoomUser(req, verifyFirebaseIdToken);
    if (!authResult.authenticated || !authResult.uid) {
      return res.status(authResult.status || 401).json({ error: authResult.error || 'Unauthorized' });
    }

    const meetingId = String(req.params?.meetingId || '').replace(/[^0-9]/g, '');
    if (!meetingId || meetingId.length < 8) {
      return res.status(400).json({ error: 'Valid numeric Zoom meetingId is required.' });
    }

    const entry = inMemoryZoomVault.get(authResult.uid);
    const creds = entry ? decryptZoomPayloadFromVault(entry) : null;
    if (!creds) {
      return res.status(401).json({ error: 'Zoom credentials are not configured.' });
    }

    const tokenRes = await getZoomAccessTokenForUid(authResult.uid, creds);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return res.status(502).json({ error: tokenRes.error || 'OAuth token unavailable.' });
    }

    const apiRes = await performZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${tokenRes.accessToken}`,
        Accept: 'application/json'
      }
    });

    if (apiRes.status !== 204 && (apiRes.status < 200 || apiRes.status >= 300) && apiRes.status !== 404) {
      let msg = `Zoom DELETE error (HTTP ${apiRes.status})`;
      try {
        const errObj = JSON.parse(apiRes.bodyText);
        msg = errObj.message || msg;
      } catch {}
      return res.status(502).json({ error: msg });
    }

    return res.status(200).json({ deleted: true, zoomMeetingId: meetingId });
  });
}
