import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'glueck_teacher_session';

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || 'glueck_lernstudio_default_session_secret_32_chars';
}

export function getTeacherPassword(): string {
  return process.env.TEACHER_PASSWORD || 'glueck123';
}

/**
 * Creates an HMAC signed session token
 */
export function createSessionToken(): string {
  const payload = JSON.stringify({
    role: 'teacher',
    created: Date.now()
  });
  const encodedPayload = Buffer.from(payload).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

/**
 * Validates an HMAC signed session token
 */
export function verifySessionToken(token: string | null | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [encodedPayload, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  if (signature !== expectedSignature) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf-8'));
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.created > maxAge) return false;
    return payload.role === 'teacher';
  } catch {
    return false;
  }
}

export function getCookieHeader(req: any): string {
  if (!req) return '';
  if (req.headers) {
    if (typeof req.headers.get === 'function') {
      return req.headers.get('cookie') || '';
    }
    if (typeof req.headers.cookie === 'string') {
      return req.headers.cookie;
    }
  }
  return '';
}

export function getCookie(req: any, name: string): string | null {
  if (req?.cookies && typeof req.cookies[name] === 'string') {
    return req.cookies[name];
  }
  const cookieHeader = getCookieHeader(req);
  const match = cookieHeader.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function isTeacherAuthenticated(req: any): boolean {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
}

/**
 * Universal helper to parse JSON body from either Vercel Node request (req.body) or Web Request (req.json())
 */
export async function parseRequestBody(req: any): Promise<any> {
  if (!req) return {};
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return JSON.parse(req.body);
      } catch {
        return {};
      }
    }
    if (Buffer.isBuffer(req.body)) {
      try {
        return JSON.parse(req.body.toString('utf-8'));
      } catch {
        return {};
      }
    }
    if (typeof req.body === 'object') {
      return req.body;
    }
  }
  if (typeof req.json === 'function') {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }
  return await new Promise((resolve) => {
    if (typeof req.on !== 'function') {
      resolve({});
      return;
    }
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/**
 * Universal helper to extract query parameters from either Vercel Node request (req.query) or URL
 */
export function getQueryParam(req: any, key: string): string | null {
  if (req?.query && req.query[key] !== undefined) {
    const val = req.query[key];
    return Array.isArray(val) ? val[0] : String(val);
  }
  try {
    const rawUrl = req?.url || '';
    const fullUrl = rawUrl.startsWith('http') ? rawUrl : `http://localhost${rawUrl.startsWith('/') ? '' : '/'}${rawUrl}`;
    const url = new URL(fullUrl);
    return url.searchParams.get(key);
  } catch {
    return null;
  }
}

/**
 * Universal JSON response sender that supports both Vercel Node (req, res) and Web Fetch Response
 */
export function sendJson(res: any, status: number, data: any, extraHeaders?: Record<string, string>) {
  if (res && typeof res.status === 'function') {
    if (extraHeaders) {
      for (const [k, v] of Object.entries(extraHeaders)) {
        res.setHeader(k, v);
      }
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(status).json(data);
  }
  if (res && typeof res.writeHead === 'function') {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {})
    });
    res.end(JSON.stringify(data));
    return;
  }
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders || {})
    }
  });
}
