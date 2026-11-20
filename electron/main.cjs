const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

// Single instance lock to prevent duplicate heavy Electron processes
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

// Chromium GPU Acceleration & Hardware Rendering flags for Linux (X11 & Wayland) and Desktop
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,CanvasOopRasterization,RasterColorConversion');
app.commandLine.appendSwitch('ozone-platform-hint', 'auto'); // Auto-detect Wayland vs X11 on Linux
app.commandLine.appendSwitch('renderer-process-limit', '4');
app.commandLine.appendSwitch('disk-cache-size', '104857600'); // 100 MB disk cache cap

let mainWindow = null;

const GRAIN_API_ORIGIN = 'https://api.grain.com';
const GRAIN_API_VERSION = '2026-10-01';
const SAFE_RECORDING_ID = /^[a-zA-Z0-9_-]{4,128}$/;

function getGrainEncryptedVaultPath() {
  return path.join(app.getPath('userData'), 'grain-pat-vault.enc');
}

function maskGrainToken(token) {
  const trimmed = String(token || '').trim();
  if (trimmed.length <= 12) return 'grain_pat_••••';
  return 'grain_pat_••••••••' + trimmed.slice(-4);
}

function isEncryptionSupported() {
  try {
    return Boolean(safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable());
  } catch {
    return false;
  }
}

function normalizeElectronGrainTokenInput(rawInput) {
  let clean = String(rawInput || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/g, '')
    .trim();

  if (
    (clean.startsWith('"') && clean.endsWith('"')) ||
    (clean.startsWith("'") && clean.endsWith("'")) ||
    (clean.startsWith('`') && clean.endsWith('`'))
  ) {
    clean = clean.slice(1, -1).trim();
  }

  clean = clean.replace(/^(?:authorization\s*:\s*)?bearer\s+/i, '').trim();

  const patMatch = clean.match(/(grain_[a-z0-9_]*_[A-Za-z0-9._~+/=-]{6,})/i);
  if (patMatch && patMatch[1]) {
    return patMatch[1];
  }

  return clean.replace(/\s+/g, '');
}

function loadDecryptedElectronGrainToken() {
  if (!isEncryptionSupported()) return null;
  try {
    const vaultPath = getGrainEncryptedVaultPath();
    if (!fs.existsSync(vaultPath)) return null;
    const rawBuf = fs.readFileSync(vaultPath);
    if (!rawBuf || rawBuf.length === 0) return null;
    const decrypted = safeStorage.decryptString(rawBuf);
    const normalized = normalizeElectronGrainTokenInput(decrypted);
    return normalized.length >= 8 ? normalized : null;
  } catch {
    return null;
  }
}

function saveEncryptedElectronGrainToken(rawToken) {
  if (!isEncryptionSupported()) {
    const err = new Error('OS keyring / safeStorage encryption is unavailable on this desktop system.');
    err.code = 'SECURE_STORAGE_UNAVAILABLE';
    throw err;
  }
  const clean = normalizeElectronGrainTokenInput(rawToken);
  if (!clean || clean.length < 8 || !/^[A-Za-z0-9._~+/=:-]+$/.test(clean)) {
    const err = new Error('Invalid Grain Personal Access Token format.');
    err.code = 'INVALID_TOKEN_FORMAT';
    throw err;
  }
  const encryptedBuf = safeStorage.encryptString(clean);
  const vaultPath = getGrainEncryptedVaultPath();
  fs.writeFileSync(vaultPath, encryptedBuf, { mode: 0o600 });
  return maskGrainToken(clean);
}

function clearEncryptedElectronGrainToken() {
  try {
    const vaultPath = getGrainEncryptedVaultPath();
    if (fs.existsSync(vaultPath)) {
      fs.unlinkSync(vaultPath);
    }
  } catch {
    // Ignore file removal errors
  }
}

function validateIpcSender(event) {
  if (!event || !mainWindow || mainWindow.isDestroyed()) {
    throw new Error('Unauthorized IPC sender: window unavailable');
  }
  if (event.sender !== mainWindow.webContents) {
    throw new Error('Unauthorized IPC sender: webContents mismatch');
  }
  const frameUrl = String(event.senderFrame?.url || '');
  if (
    frameUrl &&
    !frameUrl.startsWith('file://') &&
    !frameUrl.startsWith('http://localhost:') &&
    !frameUrl.startsWith('http://127.0.0.1:')
  ) {
    throw new Error('Unauthorized IPC sender frame URL');
  }
}

function registerGrainSecureIpcHandlers() {
  ipcMain.handle('grain:status', async (event) => {
    validateIpcSender(event);
    const encAvailable = isEncryptionSupported();
    const token = encAvailable ? loadDecryptedElectronGrainToken() : null;
    return {
      supported: encAvailable,
      secureStorageAvailable: encAvailable,
      runtime: 'electron',
      hasToken: Boolean(token),
      maskedToken: token ? maskGrainToken(token) : null
    };
  });

  ipcMain.handle('grain:saveToken', async (event, payload) => {
    validateIpcSender(event);
    const rawToken = typeof payload?.token === 'string' ? payload.token : '';
    const maskedToken = saveEncryptedElectronGrainToken(rawToken);
    return {
      saved: true,
      hasToken: true,
      maskedToken,
      secureStorageAvailable: true
    };
  });

  ipcMain.handle('grain:disconnect', async (event) => {
    validateIpcSender(event);
    clearEncryptedElectronGrainToken();
    return {
      disconnected: true,
      hasToken: false
    };
  });

function sanitizeElectronGrainPayload(operation, rawJson) {
  let p = {};
  if (typeof rawJson === 'string' && rawJson.trim()) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        p = parsed;
      } else {
        return { valid: false, error: 'Request payload must be a plain JSON object.', code: 'BAD_REQUEST' };
      }
    } catch {
      return { valid: false, error: 'Malformed JSON request body.', code: 'BAD_REQUEST' };
    }
  }

  const forbiddenTopKeys = [
    'after_datetime',
    'before_datetime',
    'title_search',
    'participant_scope',
    'attendance',
    'team',
    'meeting_type'
  ];
  const allowedListTopKeys = new Set(['cursor', 'filter', 'include']);
  const allowedDetailsTopKeys = new Set(['include']);
  const allowedFilterKeys = new Set([
    'before_datetime',
    'after_datetime',
    'participant_scope',
    'title_search',
    'team',
    'meeting_type',
    'attendance'
  ]);
  const booleanIncludeKeys = [
    'highlights',
    'participants',
    'ai_action_items',
    'ai_summary',
    'private_notes',
    'calendar_event',
    'hubspot',
    'screenshares',
    'sensitivity_matches'
  ];
  const allowedIncludeKeys = new Set([...booleanIncludeKeys, 'ai_template_sections']);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const sanitizeInclude = (rawInc) => {
    if (!rawInc || typeof rawInc !== 'object' || Array.isArray(rawInc)) return undefined;
    const out = {};
    for (const k of booleanIncludeKeys) {
      if (rawInc[k] === true) out[k] = true;
    }
    if (rawInc.ai_template_sections && typeof rawInc.ai_template_sections === 'object' && !Array.isArray(rawInc.ai_template_sections)) {
      const ats = rawInc.ai_template_sections;
      const cleanAts = {
        format: ats.format === 'json' || ats.format === 'markdown' || ats.format === 'text' ? ats.format : 'json'
      };
      if (Array.isArray(ats.allowed_sections)) {
        const secs = ats.allowed_sections.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim());
        if (secs.length > 0) cleanAts.allowed_sections = secs;
      }
      out.ai_template_sections = cleanAts;
    } else if (rawInc.ai_template_sections === true) {
      out.ai_template_sections = { format: 'json' };
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  if (operation === 'list_recordings') {
    for (const fk of forbiddenTopKeys) {
      if (p[fk] !== undefined) {
        return {
          valid: false,
          error: `Field "${fk}" must be nested inside "filter", not sent as a top-level field.`,
          code: 'INVALID_TOP_LEVEL_FILTER'
        };
      }
    }
    for (const k of Object.keys(p)) {
      if (!allowedListTopKeys.has(k)) {
        return {
          valid: false,
          error: `Unknown top-level field "${k}" is not allowed in list_recordings.`,
          code: 'UNKNOWN_FIELD_FORBIDDEN'
        };
      }
    }
    if (p.filter !== undefined) {
      if (!p.filter || typeof p.filter !== 'object' || Array.isArray(p.filter)) {
        return { valid: false, error: '"filter" must be a plain JSON object.', code: 'INVALID_FILTER_OBJECT' };
      }
      for (const fk of Object.keys(p.filter)) {
        if (!allowedFilterKeys.has(fk)) {
          return { valid: false, error: `Unknown filter field "${fk}" is not allowed.`, code: 'UNKNOWN_FILTER_FIELD' };
        }
      }
    }
    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return { valid: false, error: '"include" must be a plain JSON object.', code: 'INVALID_INCLUDE_OBJECT' };
      }
      for (const ik of Object.keys(p.include)) {
        if (!allowedIncludeKeys.has(ik)) {
          return { valid: false, error: `Unknown include field "${ik}" is not allowed.`, code: 'UNKNOWN_INCLUDE_FIELD' };
        }
      }
    }
    const body = {};
    if (typeof p.cursor === 'string' && p.cursor.trim()) {
      body.cursor = p.cursor.trim();
    }
    if (p.filter && typeof p.filter === 'object' && !Array.isArray(p.filter)) {
      const f = {};
      const normIso = (v) => {
        if (typeof v !== 'string' || !v.trim()) return undefined;
        const ms = Date.parse(v.trim());
        return Number.isFinite(ms) ? new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z') : undefined;
      };
      const beforeDt = normIso(p.filter.before_datetime);
      if (beforeDt) f.before_datetime = beforeDt;
      const afterDt = normIso(p.filter.after_datetime);
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
      if (typeof p.filter.team === 'string' && uuidRegex.test(p.filter.team.trim())) {
        f.team = p.filter.team.trim();
      }
      if (typeof p.filter.meeting_type === 'string' && uuidRegex.test(p.filter.meeting_type.trim())) {
        f.meeting_type = p.filter.meeting_type.trim();
      }
      if (Object.keys(f).length > 0) body.filter = f;
    }
    const cleanInc = sanitizeInclude(p.include);
    if (cleanInc) body.include = cleanInc;
    return { valid: true, bodyString: JSON.stringify(body) };
  }

  if (operation === 'recording_details') {
    for (const k of Object.keys(p)) {
      if (!allowedDetailsTopKeys.has(k)) {
        return {
          valid: false,
          error: `Unknown top-level field "${k}" is not allowed in recording_details.`,
          code: 'UNKNOWN_FIELD_FORBIDDEN'
        };
      }
    }
    if (p.include !== undefined) {
      if (!p.include || typeof p.include !== 'object' || Array.isArray(p.include)) {
        return { valid: false, error: '"include" must be a plain JSON object.', code: 'INVALID_INCLUDE_OBJECT' };
      }
      for (const ik of Object.keys(p.include)) {
        if (!allowedIncludeKeys.has(ik)) {
          return { valid: false, error: `Unknown include field "${ik}" is not allowed.`, code: 'UNKNOWN_INCLUDE_FIELD' };
        }
      }
    }
    const body = {};
    const cleanInc = sanitizeInclude(p.include);
    if (cleanInc) body.include = cleanInc;
    return { valid: true, bodyString: JSON.stringify(body) };
  }

  return { valid: true, bodyString: '{}' };
}

  ipcMain.handle('grain:executeOperation', async (event, payload) => {
    validateIpcSender(event);
    const token = loadDecryptedElectronGrainToken();
    if (!token) {
      return {
        httpStatus: 401,
        bodyText: JSON.stringify({ error: 'Grain Personal Access Token is not configured.', code: 'TOKEN_MISSING' })
      };
    }

    const operation = String(payload?.operation || '');
    const recordingId = String(payload?.recordingId || '').trim();
    const payloadJson = typeof payload?.payloadJson === 'string' && payload.payloadJson.trim() ? payload.payloadJson : '{}';

    let endpointPath = '';
    let method = 'GET';
    let bodyToSend = undefined;

    if (operation === 'token_info') {
      endpointPath = '/_/public-api/v2/token-info';
      method = 'GET';
    } else if (operation === 'list_recordings') {
      endpointPath = '/_/public-api/v2/recordings';
      method = 'POST';
      const sanitized = sanitizeElectronGrainPayload('list_recordings', payloadJson);
      if (!sanitized.valid) {
        return {
          httpStatus: 400,
          bodyText: JSON.stringify({ error: sanitized.error, code: sanitized.code || 'BAD_REQUEST' })
        };
      }
      bodyToSend = sanitized.bodyString;
    } else if (operation === 'recording_details') {
      if (!SAFE_RECORDING_ID.test(recordingId)) {
        return {
          httpStatus: 400,
          bodyText: JSON.stringify({ error: 'Invalid recordingId parameter.', code: 'BAD_REQUEST' })
        };
      }
      endpointPath = `/_/public-api/v2/recordings/${recordingId}`;
      method = 'POST';
      const sanitized = sanitizeElectronGrainPayload('recording_details', payloadJson);
      if (!sanitized.valid) {
        return {
          httpStatus: 400,
          bodyText: JSON.stringify({ error: sanitized.error, code: sanitized.code || 'BAD_REQUEST' })
        };
      }
      bodyToSend = sanitized.bodyString;
    } else if (operation === 'recording_transcript') {
      if (!SAFE_RECORDING_ID.test(recordingId)) {
        return {
          httpStatus: 400,
          bodyText: JSON.stringify({ error: 'Invalid recordingId parameter.', code: 'BAD_REQUEST' })
        };
      }
      endpointPath = `/_/public-api/v2/recordings/${recordingId}/transcript`;
      method = 'GET';
    } else {
      return {
        httpStatus: 400,
        bodyText: JSON.stringify({ error: 'Unsupported Grain operation.', code: 'UNSUPPORTED_OPERATION' })
      };
    }

    const targetUrl = new URL(endpointPath, GRAIN_API_ORIGIN);
    if (targetUrl.origin !== GRAIN_API_ORIGIN || targetUrl.pathname.includes('..')) {
      return {
        httpStatus: 400,
        bodyText: JSON.stringify({ error: 'Forbidden target URL.', code: 'FORBIDDEN_URL' })
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(targetUrl.toString(), {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Public-Api-Version': GRAIN_API_VERSION,
          Accept: 'application/json',
          ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {})
        },
        body: method === 'POST' ? bodyToSend : undefined,
        redirect: 'manual',
        signal: controller.signal
      });
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
      return {
        httpStatus: response.status,
        retryAfter,
        bodyText
      };
    } catch {
      return {
        httpStatus: 502,
        bodyText: JSON.stringify({ error: 'Network error communicating with Grain API.', code: 'NETWORK_ERROR' })
      };
    } finally {
      clearTimeout(timeoutId);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false, // Prevent white flash on Linux startup
    backgroundColor: '#0f172a', // Matches dark theme background
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: true, // Throttles background timers when minimized to save CPU/RAM
      spellcheck: false, // Saves ~100MB+ RAM by disabling Chromium spellcheck dictionaries
      webSecurity: true
    },
    icon: path.join(__dirname, '../dist/icon.png')
  });

  // Load the compiled index.html
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));

  // Reveal window seamlessly when ready to render
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const ZOOM_OAUTH_TOKEN_URL = 'https://zoom.us/oauth/token';
const ZOOM_API_BASE_URL = 'https://api.zoom.us/v2';
let cachedElectronZoomToken = null;

function getZoomEncryptedVaultPath() {
  return path.join(app.getPath('userData'), 'zoom-s2s-vault.enc');
}

function normalizeElectronZoomCredential(raw) {
  let str = String(raw || '')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00A0]/g, '')
    .trim();
  str = str.replace(/^["'`]+|["'`]+$/g, '').trim();
  return str.replace(/\s+/g, '');
}

function maskElectronZoomCredential(val) {
  const clean = String(val || '').trim();
  if (clean.length <= 6) return '••••••';
  return `${clean.slice(0, 3)}••••••••${clean.slice(-4)}`;
}

function loadDecryptedElectronZoomCreds() {
  if (!isEncryptionSupported()) return null;
  try {
    const vaultPath = getZoomEncryptedVaultPath();
    if (!fs.existsSync(vaultPath)) return null;
    const rawBuf = fs.readFileSync(vaultPath);
    if (!rawBuf || rawBuf.length === 0) return null;
    const decrypted = safeStorage.decryptString(rawBuf);
    return JSON.parse(decrypted);
  } catch {
    return null;
  }
}

function saveEncryptedElectronZoomCreds(payload) {
  if (!isEncryptionSupported()) {
    throw new Error('OS keyring / safeStorage encryption is unavailable on this desktop system.');
  }
  const encryptedBuf = safeStorage.encryptString(JSON.stringify(payload));
  fs.writeFileSync(getZoomEncryptedVaultPath(), encryptedBuf, { mode: 0o600 });
}

function clearEncryptedElectronZoomCreds() {
  cachedElectronZoomToken = null;
  try {
    const vaultPath = getZoomEncryptedVaultPath();
    if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath);
  } catch {}
}

function parseElectronZoomJsonSafeIds(rawText) {
  const safeText = String(rawText || '').replace(/"id"\s*:\s*(\d{8,25})(?=\s*[,}\]])/g, '"id":"$1"');
  return JSON.parse(safeText);
}

async function performElectronZoomFetch(url, init, retriesLeft = 3) {
  const parsedUrl = new URL(url);
  if (parsedUrl.protocol !== 'https:' || (parsedUrl.hostname !== 'zoom.us' && parsedUrl.hostname !== 'api.zoom.us')) {
    return { status: 400, bodyText: JSON.stringify({ message: 'Forbidden target host.' }) };
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  try {
    const resp = await fetch(url, { ...init, redirect: 'manual', signal: controller.signal });
    if (resp.status >= 300 && resp.status < 400) {
      return { status: 502, bodyText: JSON.stringify({ message: 'Upstream redirect refused for security.' }) };
    }
    const bodyText = await resp.text();
    const retryAfter = resp.headers.get('retry-after') || undefined;
    if ((resp.status === 429 || resp.status >= 500) && retriesLeft > 0) {
      const waitMs = retryAfter
        ? Math.min(5000, Math.max(400, Number(retryAfter) * 1000 || 1000))
        : Math.min(3500, 450 * (4 - Math.min(3, retriesLeft)));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return performElectronZoomFetch(url, init, retriesLeft - 1);
    }
    return { status: resp.status, bodyText, retryAfter };
  } catch (err) {
    if (retriesLeft > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(3000, 450 * (4 - Math.min(3, retriesLeft)))));
      return performElectronZoomFetch(url, init, retriesLeft - 1);
    }
    return { status: 502, bodyText: JSON.stringify({ message: err?.message || 'Zoom network timeout' }) };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getElectronZoomAccessToken(creds, forceRefresh = false) {
  if (!forceRefresh && cachedElectronZoomToken && cachedElectronZoomToken.expiresAtMs > Date.now() + 5 * 60 * 1000) {
    return { ok: true, accessToken: cachedElectronZoomToken.accessToken };
  }
  const basicAuth = Buffer.from(`${creds.clientId}:${creds.clientSecret}`, 'utf8').toString('base64');
  const formBody = `grant_type=account_credentials&account_id=${encodeURIComponent(creds.accountId)}`;
  const res = await performElectronZoomFetch(ZOOM_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: formBody
  });
  if (res.status < 200 || res.status >= 300) {
    let reason = `Zoom Server-to-Server OAuth authentication failed (HTTP ${res.status}).`;
    try {
      const p = JSON.parse(res.bodyText);
      reason = p.reason || p.error_description || p.message || reason;
    } catch {}
    return { ok: false, status: res.status, error: reason };
  }
  try {
    const parsed = JSON.parse(res.bodyText);
    const accessToken = String(parsed.access_token || '').trim();
    const expiresInSec = Math.max(120, Number(parsed.expires_in) || 3600);
    if (!accessToken) return { ok: false, status: 502, error: 'Zoom OAuth response omitted access_token.' };
    cachedElectronZoomToken = { accessToken, expiresAtMs: Date.now() + expiresInSec * 1000 };
    return { ok: true, accessToken };
  } catch {
    return { ok: false, status: 502, error: 'Invalid JSON response from Zoom OAuth server.' };
  }
}

async function probeElectronZoomHostProfile(accessToken) {
  const res = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/users/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
  });
  if (res.status < 200 || res.status >= 300) {
    let msg = `Zoom /users/me check returned HTTP ${res.status}`;
    try {
      msg = JSON.parse(res.bodyText).message || msg;
    } catch {}
    return { ok: false, planType: 'unknown', isBasicPlan: false, status: res.status, error: msg };
  }
  try {
    const u = JSON.parse(res.bodyText);
    const userType = Number(u.type);
    const planType = userType === 1 ? 'basic' : userType >= 2 ? 'licensed' : 'unknown';
    return {
      ok: true,
      email: typeof u.email === 'string' ? u.email : undefined,
      userId: typeof u.id === 'string' ? u.id : undefined,
      planType,
      isBasicPlan: planType === 'basic',
      status: res.status
    };
  } catch {
    return { ok: true, planType: 'unknown', isBasicPlan: false, status: res.status };
  }
}

function registerZoomSecureIpcHandlers() {
  ipcMain.handle('zoom:status', async (event) => {
    validateIpcSender(event);
    const encAvailable = isEncryptionSupported();
    const creds = encAvailable ? loadDecryptedElectronZoomCreds() : null;
    if (!creds) {
      return {
        ok: true,
        httpStatus: 200,
        secureStorageAvailable: encAvailable,
        hasCredentials: false,
        defaultTimezone: 'Africa/Cairo',
        planType: 'unknown',
        isBasicPlan: false,
        maxMeetingMinutes: null
      };
    }
    return {
      ok: true,
      httpStatus: 200,
      secureStorageAvailable: encAvailable,
      hasCredentials: true,
      maskedAccountId: maskElectronZoomCredential(creds.accountId),
      maskedClientId: maskElectronZoomCredential(creds.clientId),
      defaultTimezone: creds.defaultTimezone || 'Africa/Cairo',
      planType: creds.planType || 'unknown',
      isBasicPlan: Boolean(creds.isBasicPlan),
      maxMeetingMinutes: creds.isBasicPlan ? 40 : null,
      hostEmail: creds.hostEmail || null,
      updatedAt: creds.updatedAt
    };
  });

  ipcMain.handle('zoom:connect', async (event, payload) => {
    validateIpcSender(event);
    if (!isEncryptionSupported()) {
      return { ok: false, httpStatus: 503, saved: false, error: 'OS keyring / safeStorage encryption is unavailable.' };
    }
    const accountId = normalizeElectronZoomCredential(payload?.accountId);
    const clientId = normalizeElectronZoomCredential(payload?.clientId);
    const clientSecret = normalizeElectronZoomCredential(payload?.clientSecret);
    const defaultTimezone = String(payload?.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    if (accountId.length < 6 || clientId.length < 6 || clientSecret.length < 8) {
      return { ok: false, httpStatus: 400, saved: false, error: 'Account ID, Client ID, and Client Secret are required and appear too short.' };
    }
    cachedElectronZoomToken = null;
    const tempCreds = { accountId, clientId, clientSecret, defaultTimezone, updatedAt: new Date().toISOString() };
    const tokenRes = await getElectronZoomAccessToken(tempCreds, true);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return { ok: false, httpStatus: tokenRes.status === 400 || tokenRes.status === 401 ? 401 : 502, saved: false, connected: false, error: tokenRes.error };
    }
    const profileRes = await probeElectronZoomHostProfile(tokenRes.accessToken);
    const finalCreds = {
      ...tempCreds,
      planType: profileRes.ok ? profileRes.planType : 'unknown',
      isBasicPlan: profileRes.ok ? profileRes.isBasicPlan : false,
      hostEmail: profileRes.email,
      hostUserId: profileRes.userId
    };
    saveEncryptedElectronZoomCreds(finalCreds);
    return {
      ok: true,
      httpStatus: 200,
      saved: true,
      connected: true,
      maskedAccountId: maskElectronZoomCredential(accountId),
      maskedClientId: maskElectronZoomCredential(clientId),
      defaultTimezone: finalCreds.defaultTimezone,
      planType: finalCreds.planType,
      isBasicPlan: Boolean(finalCreds.isBasicPlan),
      maxMeetingMinutes: finalCreds.isBasicPlan ? 40 : null,
      hostEmail: finalCreds.hostEmail || null
    };
  });

  ipcMain.handle('zoom:testConnection', async (event) => {
    validateIpcSender(event);
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 404, connected: false, error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds, true);
    if (!tokenRes.ok || !tokenRes.accessToken) {
      return { ok: true, httpStatus: 200, connected: false, error: tokenRes.error || 'OAuth token refresh failed.' };
    }
    const profileRes = await probeElectronZoomHostProfile(tokenRes.accessToken);
    if (profileRes.ok) {
      saveEncryptedElectronZoomCreds({
        ...creds,
        planType: profileRes.planType,
        isBasicPlan: profileRes.isBasicPlan,
        hostEmail: profileRes.email || creds.hostEmail,
        hostUserId: profileRes.userId || creds.hostUserId
      });
    }
    return {
      ok: true,
      httpStatus: 200,
      connected: true,
      planType: profileRes.planType,
      isBasicPlan: profileRes.isBasicPlan,
      maxMeetingMinutes: profileRes.isBasicPlan ? 40 : null,
      hostEmail: profileRes.email || creds.hostEmail || null,
      defaultTimezone: creds.defaultTimezone || 'Africa/Cairo',
      profileCheckWarning: profileRes.ok ? null : profileRes.error
    };
  });

  ipcMain.handle('zoom:updateSettings', async (event, payload) => {
    validateIpcSender(event);
    const defaultTimezone = String(payload?.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const creds = loadDecryptedElectronZoomCreds();
    if (creds) {
      saveEncryptedElectronZoomCreds({ ...creds, defaultTimezone, updatedAt: new Date().toISOString() });
    }
    return { ok: true, httpStatus: 200, saved: true, defaultTimezone };
  });

  ipcMain.handle('zoom:disconnect', async (event) => {
    validateIpcSender(event);
    clearEncryptedElectronZoomCreds();
    return { ok: true, httpStatus: 200, disconnected: true, hasCredentials: false };
  });

  ipcMain.handle('zoom:createMeeting', async (event, payload) => {
    validateIpcSender(event);
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 401, code: 'CREDENTIALS_MISSING', error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds);
    if (!tokenRes.ok || !tokenRes.accessToken) return { ok: false, httpStatus: 502, error: tokenRes.error || 'OAuth token unavailable.' };
    const topic = String(payload?.topic || '').trim().slice(0, 200);
    const startTime = String(payload?.startTime || '').trim();
    const duration = Math.max(15, Math.min(300, Number(payload?.duration) || 60));
    const timezone = String(payload?.timezone || creds.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const weeklyDay = Math.max(1, Math.min(7, Number(payload?.weeklyDay) || 2));
    const repeatInterval = Number(payload?.repeatInterval) === 2 ? 2 : 1;
    if (!topic || !startTime) return { ok: false, httpStatus: 400, error: 'topic and startTime are required to create a Zoom meeting.' };

    const apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/users/me/meetings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenRes.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        topic,
        type: 8,
        start_time: startTime,
        duration,
        timezone,
        recurrence: { type: 2, repeat_interval: repeatInterval, weekly_days: String(weeklyDay), end_times: 50 },
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: payload?.waitingRoom === true,
          auto_recording: payload?.autoRecording === 'cloud' ? 'cloud' : 'none'
        }
      })
    });
    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom API error (HTTP ${apiRes.status})`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      return { ok: false, httpStatus: apiRes.status === 429 ? 429 : 502, error: msg, retryAfter: apiRes.retryAfter };
    }
    const m = JSON.parse(apiRes.bodyText);
    return {
      ok: true,
      httpStatus: 200,
      zoomMeetingId: String(m.id || ''),
      joinUrl: String(m.join_url || ''),
      startUrl: typeof m.start_url === 'string' ? m.start_url : undefined,
      meetingPasscode: typeof m.password === 'string' ? m.password : undefined,
      topic: String(m.topic || topic),
      timezone: String(m.timezone || timezone),
      hostEmail: creds.hostEmail || undefined,
      planWarning40Min: Boolean(creds.isBasicPlan && duration >= 41)
    };
  });

  ipcMain.handle('zoom:updateMeeting', async (event, payload) => {
    validateIpcSender(event);
    const meetingId = String(payload?.meetingId || '').replace(/[^0-9]/g, '');
    if (meetingId.length < 8) return { ok: false, httpStatus: 400, error: 'Valid numeric Zoom meetingId is required.' };
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 401, error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds);
    if (!tokenRes.ok || !tokenRes.accessToken) return { ok: false, httpStatus: 502, error: tokenRes.error || 'OAuth token unavailable.' };
    const topic = String(payload?.topic || '').trim().slice(0, 200);
    const startTime = String(payload?.startTime || '').trim();
    const duration = Math.max(15, Math.min(300, Number(payload?.duration) || 60));
    const timezone = String(payload?.timezone || creds.defaultTimezone || 'Africa/Cairo').trim() || 'Africa/Cairo';
    const weeklyDay = Math.max(1, Math.min(7, Number(payload?.weeklyDay) || 2));
    const repeatInterval = Number(payload?.repeatInterval) === 2 ? 2 : 1;
    const patchBody = {
      type: 8,
      duration,
      timezone,
      recurrence: { type: 2, repeat_interval: repeatInterval, weekly_days: String(weeklyDay), end_times: 50 },
      settings: {
        waiting_room: payload?.waitingRoom === true
      }
    };
    if (topic) patchBody.topic = topic;
    if (startTime) patchBody.start_time = startTime;
    const apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${tokenRes.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(patchBody)
    });
    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom PATCH error (HTTP ${apiRes.status})`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      return { ok: false, httpStatus: apiRes.status === 404 ? 404 : 502, error: msg };
    }
    return { ok: true, httpStatus: 200, updated: true, zoomMeetingId: meetingId, topic: topic || undefined, planWarning40Min: Boolean(creds.isBasicPlan && duration >= 41) };
  });

  ipcMain.handle('zoom:listMeetings', async (event, payload) => {
    validateIpcSender(event);
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 401, code: 'CREDENTIALS_MISSING', error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds);
    if (!tokenRes.ok || !tokenRes.accessToken) return { ok: false, httpStatus: tokenRes.status === 401 ? 401 : 502, error: tokenRes.error || 'OAuth token unavailable.' };
    const rawType = String(payload?.type || 'scheduled').trim();
    const listType = rawType === 'live' || rawType === 'upcoming' || rawType === 'scheduled' ? rawType : 'scheduled';
    const pageSize = Math.max(1, Math.min(300, Number(payload?.pageSize) || 300));
    const nextPageToken = String(payload?.nextPageToken || '').trim();
    const qs = new URLSearchParams({ type: listType, page_size: String(pageSize) });
    if (nextPageToken) qs.set('next_page_token', nextPageToken);

    let apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/users/me/meetings?${qs.toString()}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenRes.accessToken}`, Accept: 'application/json' }
    });
    if (apiRes.status === 401) {
      const refreshed = await getElectronZoomAccessToken(creds, true);
      if (refreshed.ok && refreshed.accessToken) {
        apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/users/me/meetings?${qs.toString()}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${refreshed.accessToken}`, Accept: 'application/json' }
        }, 0);
      }
    }
    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom list meetings error (HTTP ${apiRes.status})`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      const outStatus = apiRes.status === 401 || apiRes.status === 403 || apiRes.status === 429 || apiRes.status >= 500 ? apiRes.status : 502;
      return {
        ok: false,
        httpStatus: outStatus,
        code: apiRes.status === 429 ? 'RATE_LIMITED' : apiRes.status === 401 ? 'UNAUTHORIZED' : apiRes.status === 403 ? 'FORBIDDEN' : undefined,
        error: msg,
        retryAfter: apiRes.retryAfter
      };
    }
    try {
      const parsed = parseElectronZoomJsonSafeIds(apiRes.bodyText);
      const rawMeetings = Array.isArray(parsed.meetings) ? parsed.meetings : [];
      const meetings = rawMeetings.map((m) => ({
        id: m && m.id !== undefined && m.id !== null ? String(m.id) : '',
        uuid: typeof m?.uuid === 'string' ? m.uuid : undefined,
        hostId: typeof m?.host_id === 'string' ? m.host_id : undefined,
        topic: typeof m?.topic === 'string' ? m.topic : '',
        type: typeof m?.type === 'number' ? m.type : 0,
        startTime: typeof m?.start_time === 'string' ? m.start_time : undefined,
        duration: typeof m?.duration === 'number' ? m.duration : undefined,
        timezone: typeof m?.timezone === 'string' ? m.timezone : undefined,
        createdAt: typeof m?.created_at === 'string' ? m.created_at : undefined,
        joinUrl: typeof m?.join_url === 'string' ? m.join_url : '',
        status: typeof m?.status === 'string' ? m.status : undefined
      }));
      return {
        ok: true,
        httpStatus: 200,
        meetings,
        nextPageToken: typeof parsed.next_page_token === 'string' ? parsed.next_page_token.trim() : '',
        pageCount: typeof parsed.page_count === 'number' ? parsed.page_count : 1,
        pageSize: typeof parsed.page_size === 'number' ? parsed.page_size : pageSize,
        totalRecords: typeof parsed.total_records === 'number' ? parsed.total_records : meetings.length,
        hostEmail: creds.hostEmail || null,
        hostScope: 'single_connected_host'
      };
    } catch {
      return { ok: false, httpStatus: 502, error: 'Invalid JSON returned by Zoom while listing meetings.' };
    }
  });

  ipcMain.handle('zoom:getMeeting', async (event, payload) => {
    validateIpcSender(event);
    const meetingId = String(payload?.meetingId || '').replace(/[^0-9]/g, '');
    if (meetingId.length < 8) return { ok: false, httpStatus: 400, error: 'Valid numeric Zoom meetingId is required.' };
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 401, error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds);
    if (!tokenRes.ok || !tokenRes.accessToken) return { ok: false, httpStatus: tokenRes.status === 401 ? 401 : 502, error: tokenRes.error || 'OAuth token unavailable.' };
    let apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenRes.accessToken}`, Accept: 'application/json' }
    });
    if (apiRes.status === 401) {
      const refreshed = await getElectronZoomAccessToken(creds, true);
      if (refreshed.ok && refreshed.accessToken) {
        apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${refreshed.accessToken}`, Accept: 'application/json' }
        }, 0);
      }
    }
    if (apiRes.status < 200 || apiRes.status >= 300) {
      let msg = `Zoom inspect error (HTTP ${apiRes.status})`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      const outStatus = apiRes.status === 401 || apiRes.status === 403 || apiRes.status === 404 || apiRes.status === 429 || apiRes.status >= 500 ? apiRes.status : 502;
      return { ok: false, httpStatus: outStatus, exists: apiRes.status !== 404, error: msg, retryAfter: apiRes.retryAfter };
    }
    const m = parseElectronZoomJsonSafeIds(apiRes.bodyText);
    return {
      ok: true,
      httpStatus: 200,
      exists: true,
      zoomMeetingId: String(m.id || meetingId),
      topic: String(m.topic || ''),
      joinUrl: String(m.join_url || ''),
      startUrl: typeof m.start_url === 'string' ? m.start_url : undefined,
      meetingPasscode: typeof m.password === 'string' ? m.password : undefined,
      timezone: typeof m.timezone === 'string' ? m.timezone : undefined,
      status: typeof m.status === 'string' ? m.status : 'waiting'
    };
  });

  ipcMain.handle('zoom:deleteMeeting', async (event, payload) => {
    validateIpcSender(event);
    const meetingId = String(payload?.meetingId || '').replace(/[^0-9]/g, '');
    if (meetingId.length < 8) return { ok: false, httpStatus: 400, error: 'Valid numeric Zoom meetingId is required.' };
    const creds = loadDecryptedElectronZoomCreds();
    if (!creds) return { ok: false, httpStatus: 401, error: 'Zoom credentials are not configured.' };
    const tokenRes = await getElectronZoomAccessToken(creds);
    if (!tokenRes.ok || !tokenRes.accessToken) return { ok: false, httpStatus: tokenRes.status === 401 ? 401 : 502, error: tokenRes.error || 'OAuth token unavailable.' };
    // Never pass occurrence_id so recurring series are deleted completely
    let apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${tokenRes.accessToken}`, Accept: 'application/json' }
    });
    if (apiRes.status === 401) {
      const refreshed = await getElectronZoomAccessToken(creds, true);
      if (refreshed.ok && refreshed.accessToken) {
        apiRes = await performElectronZoomFetch(`${ZOOM_API_BASE_URL}/meetings/${encodeURIComponent(meetingId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${refreshed.accessToken}`, Accept: 'application/json' }
        }, 0);
      }
    }
    if (apiRes.status === 404) {
      let msg = `Zoom meeting ${meetingId} not found (404)`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      return { ok: false, httpStatus: 404, deleted: false, alreadyDeletedCandidate: true, zoomMeetingId: meetingId, error: msg };
    }
    if (apiRes.status !== 204 && (apiRes.status < 200 || apiRes.status >= 300)) {
      let msg = `Zoom DELETE error (HTTP ${apiRes.status})`;
      try { msg = JSON.parse(apiRes.bodyText).message || msg; } catch {}
      const outStatus = apiRes.status === 401 || apiRes.status === 403 || apiRes.status === 429 || apiRes.status >= 500 ? apiRes.status : 502;
      return {
        ok: false,
        httpStatus: outStatus,
        deleted: false,
        code: apiRes.status === 429 ? 'RATE_LIMITED' : apiRes.status === 401 ? 'UNAUTHORIZED' : apiRes.status === 403 ? 'FORBIDDEN' : undefined,
        error: msg,
        retryAfter: apiRes.retryAfter
      };
    }
    return { ok: true, httpStatus: 200, deleted: true, zoomMeetingId: meetingId };
  });
}

const {
  LanSyncHostController,
  discoverLanHostsViaUdp,
  performPinnedLanRequest
} = require('./lanSyncServer.cjs');

let lanHostController = null;
const pendingLanRpcRequests = new Map();

function getLanClientVaultPath() {
  return path.join(app.getPath('userData'), 'lan-client-peers-vault.enc');
}

function loadLanClientVaultMap() {
  try {
    const filePath = getLanClientVaultPath();
    if (!fs.existsSync(filePath)) return {};
    const rawBuf = fs.readFileSync(filePath);
    if (!rawBuf || rawBuf.length === 0) return {};
    const prefix = rawBuf.subarray(0, 5).toString('ascii');
    if (prefix === 'ENC1:') {
      if (!isEncryptionSupported()) return {};
      const decoded = safeStorage.decryptString(rawBuf.subarray(5));
      return JSON.parse(decoded) || {};
    }
    return JSON.parse(rawBuf.toString('utf8')) || {};
  } catch {
    return {};
  }
}

function saveLanClientVaultMap(mapObj) {
  const filePath = getLanClientVaultPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const raw = JSON.stringify(mapObj || {});
  if (isEncryptionSupported()) {
    const enc = safeStorage.encryptString(raw);
    fs.writeFileSync(filePath, Buffer.concat([Buffer.from('ENC1:'), enc]), { mode: 0o600 });
  } else {
    fs.writeFileSync(filePath, raw, { encoding: 'utf8', mode: 0o600 });
  }
}

function invokeRendererSyncRpc(op, payload, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      reject(Object.assign(new Error('Application window unavailable for sync commit.'), { errorCode: 'STORAGE_SAVE_FAILED' }));
      return;
    }
    const requestId = `rpc_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timer = setTimeout(() => {
      pendingLanRpcRequests.delete(requestId);
      reject(Object.assign(new Error('Renderer sync handler timed out.'), { errorCode: 'CONNECTION_TIMEOUT' }));
    }, timeoutMs);

    pendingLanRpcRequests.set(requestId, {
      resolve: (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      }
    });

    try {
      mainWindow.webContents.send('lanSync:rpcRequest', { requestId, op, payload });
    } catch (err) {
      clearTimeout(timer);
      pendingLanRpcRequests.delete(requestId);
      reject(err);
    }
  });
}

function emitLanHostEvent(type, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try {
      mainWindow.webContents.send('lanSync:hostEvent', { type, data });
    } catch {}
  }
}

function getOrCreateLanHostController() {
  if (lanHostController) return lanHostController;
  lanHostController = new LanSyncHostController({
    storageDir: app.getPath('userData'),
    safeStorage,
    useTls: true
  });
  lanHostController.setRpcHandlers({
    onExchangeRequest: async (inboundDelta) => invokeRendererSyncRpc('exchange', inboundDelta),
    onPageImageManifest: async (reqBody) => invokeRendererSyncRpc('pageImageManifest', reqBody),
    onPageImageChunk: async (reqBody) => invokeRendererSyncRpc('pageImageChunk', reqBody)
  });
  lanHostController.on('status-changed', (status) => emitLanHostEvent('status-changed', status));
  lanHostController.on('peer-paired', (peer) => emitLanHostEvent('peer-paired', peer));
  lanHostController.on('peer-revoked', (info) => emitLanHostEvent('peer-revoked', info));
  lanHostController.on('network-changed', (status) => emitLanHostEvent('network-changed', status));
  return lanHostController;
}

function registerLanSyncIpcHandlers() {
  ipcMain.handle('lanSync:getHostStatus', async (event) => {
    validateIpcSender(event);
    const ctrl = getOrCreateLanHostController();
    return ctrl.getStatus();
  });

  ipcMain.handle('lanSync:startHost', async (event, payload) => {
    validateIpcSender(event);
    const ctrl = getOrCreateLanHostController();
    try {
      const status = await ctrl.start({
        localDeviceId: payload?.localDeviceId,
        localDeviceName: payload?.localDeviceName,
        port: payload?.port
      });
      return { ok: true, ...status };
    } catch (err) {
      return {
        ok: false,
        ...ctrl.getStatus(),
        bindError: err?.message || 'Failed to bind LAN sync port.',
        errorCode: err?.errorCode || 'HOST_BIND_FAILED'
      };
    }
  });

  ipcMain.handle('lanSync:stopHost', async (event) => {
    validateIpcSender(event);
    const ctrl = getOrCreateLanHostController();
    await ctrl.stop();
    return ctrl.getStatus();
  });

  ipcMain.handle('lanSync:regeneratePairingCode', async (event, payload) => {
    validateIpcSender(event);
    const ctrl = getOrCreateLanHostController();
    const res = ctrl.generatePairingCode(payload?.ttlMs);
    return { ...res, status: ctrl.getStatus() };
  });

  ipcMain.handle('lanSync:listPairedPeers', async (event) => {
    validateIpcSender(event);
    const ctrl = getOrCreateLanHostController();
    return ctrl.listPairedPeers();
  });

  ipcMain.handle('lanSync:revokePairedPeer', async (event, payload) => {
    validateIpcSender(event);
    const peerDeviceId = String(payload?.peerDeviceId || '').trim();
    const ctrl = getOrCreateLanHostController();
    const removedHost = ctrl.revokePairedPeer(peerDeviceId);
    const clientVault = loadLanClientVaultMap();
    const removedClient = Boolean(clientVault[peerDeviceId]);
    if (removedClient) {
      delete clientVault[peerDeviceId];
      saveLanClientVaultMap(clientVault);
    }
    return { revoked: removedHost || removedClient };
  });

  ipcMain.handle('lanSync:hasStoredCredentials', async (event, payload) => {
    validateIpcSender(event);
    const peerDeviceId = String(payload?.peerDeviceId || '').trim();
    const ctrl = getOrCreateLanHostController();
    if (ctrl.hasPairedPeerToken(peerDeviceId)) return { hasCredentials: true, role: 'host' };
    const clientVault = loadLanClientVaultMap();
    if (clientVault[peerDeviceId]?.authToken) return { hasCredentials: true, role: 'client' };
    return { hasCredentials: false };
  });

  ipcMain.handle('lanSync:discoverHosts', async (event, payload) => {
    validateIpcSender(event);
    const hosts = await discoverLanHostsViaUdp(payload?.timeoutMs || 1800);
    const ctrl = getOrCreateLanHostController();
    return hosts.filter((h) => h.deviceId !== ctrl.localDeviceId);
  });

  ipcMain.handle('lanSync:testConnection', async (event, payload) => {
    validateIpcSender(event);
    const res = await performPinnedLanRequest({
      host: payload?.host,
      port: payload?.port,
      method: 'GET',
      endpointPath: '/api/sync/health',
      expectedFingerprintSha256: payload?.expectedFingerprint,
      useTls: payload?.useTls !== false,
      timeoutMs: payload?.timeoutMs || 5000
    });
    return res;
  });

  ipcMain.handle('lanSync:pairClient', async (event, payload) => {
    validateIpcSender(event);
    const res = await performPinnedLanRequest({
      host: payload?.host,
      port: payload?.port,
      method: 'POST',
      endpointPath: '/api/sync/pair',
      body: {
        pairingCode: payload?.pairingCode,
        clientDeviceId: payload?.localDeviceId,
        clientDeviceName: payload?.localDeviceName,
        header: payload?.header
      },
      expectedFingerprintSha256: payload?.expectedFingerprint,
      useTls: payload?.useTls !== false,
      timeoutMs: payload?.timeoutMs || 8000
    });

    if (!res.ok || !res.data?.authToken || !res.data?.hostDeviceId) {
      return res;
    }

    const vault = loadLanClientVaultMap();
    vault[res.data.hostDeviceId] = {
      deviceId: res.data.hostDeviceId,
      deviceName: res.data.hostDeviceName,
      authToken: res.data.authToken,
      certFingerprintSha256: res.data.certFingerprintSha256 || res.certFingerprintSha256 || null,
      pairedAt: Date.now()
    };
    saveLanClientVaultMap(vault);

    // Strip raw authToken before returning to renderer so it never touches localStorage
    const { authToken: _omitted, ...safeData } = res.data;
    return {
      ...res,
      data: {
        ...safeData,
        hasStoredAuthToken: true
      }
    };
  });

  ipcMain.handle('lanSync:requestPaired', async (event, payload) => {
    validateIpcSender(event);
    const peerDeviceId = String(payload?.peerDeviceId || '').trim();
    const vault = loadLanClientVaultMap();
    const entry = vault[peerDeviceId];
    if (!entry || !entry.authToken) {
      return {
        ok: false,
        httpStatus: 401,
        errorCode: 'UNAUTHORIZED_DEVICE',
        message: 'No stored authentication token for this paired device. Re-pair required.'
      };
    }

    return await performPinnedLanRequest({
      host: payload?.host,
      port: payload?.port,
      method: payload?.method || 'POST',
      endpointPath: payload?.path || '/api/sync/status',
      body: payload?.body,
      authToken: entry.authToken,
      expectedFingerprintSha256: payload?.expectedFingerprint || entry.certFingerprintSha256,
      useTls: payload?.useTls !== false,
      timeoutMs: payload?.timeoutMs || 15000
    });
  });

  ipcMain.handle('lanSync:rpcResponse', async (event, payload) => {
    validateIpcSender(event);
    const requestId = String(payload?.requestId || '');
    const pending = pendingLanRpcRequests.get(requestId);
    if (!pending) return { received: false };
    pendingLanRpcRequests.delete(requestId);
    if (payload?.ok) {
      pending.resolve(payload.result);
    } else {
      pending.reject(Object.assign(new Error(payload?.error || 'Renderer RPC failed'), { errorCode: payload?.errorCode || 'STORAGE_SAVE_FAILED' }));
    }
    return { received: true };
  });
}

app.whenReady().then(() => {
  registerGrainSecureIpcHandlers();
  registerZoomSecureIpcHandlers();
  registerLanSyncIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.on('before-quit', () => {
  if (lanHostController) {
    void lanHostController.stop();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
