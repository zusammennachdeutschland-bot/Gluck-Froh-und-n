import crypto from 'crypto';

const SESSION_COOKIE_NAME = 'glueck_teacher_session';

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
    // 30 days session validity
    const maxAge = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - payload.created > maxAge) return false;
    return payload.role === 'teacher';
  } catch {
    return false;
  }
}

export function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export function isTeacherAuthenticated(req: Request): boolean {
  const token = getCookie(req, SESSION_COOKIE_NAME);
  return verifySessionToken(token);
}

export { SESSION_COOKIE_NAME };
