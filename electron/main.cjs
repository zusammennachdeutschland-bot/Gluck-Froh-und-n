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

function loadDecryptedElectronGrainToken() {
  if (!isEncryptionSupported()) return null;
  try {
    const vaultPath = getGrainEncryptedVaultPath();
    if (!fs.existsSync(vaultPath)) return null;
    const rawBuf = fs.readFileSync(vaultPath);
    if (!rawBuf || rawBuf.length === 0) return null;
    const decrypted = safeStorage.decryptString(rawBuf);
    return typeof decrypted === 'string' && decrypted.trim().length >= 10 ? decrypted.trim() : null;
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
  const clean = String(rawToken || '').trim();
  if (clean.length < 10) {
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

app.whenReady().then(() => {
  registerGrainSecureIpcHandlers();
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
