import {
  createSessionToken,
  getTeacherPassword,
  isTeacherAuthenticated,
  parseRequestBody,
  sendJson,
  SESSION_COOKIE_NAME
} from '../_auth.js';

export default async function handler(req: any, res?: any) {
  const method = (req?.method || 'GET').toUpperCase();

  if (method === 'GET') {
    const authed = isTeacherAuthenticated(req);
    return sendJson(res, 200, { authenticated: authed });
  }

  if (method === 'POST') {
    try {
      const body = await parseRequestBody(req);
      const password = (body?.password || '').trim();
      const correctPassword = getTeacherPassword();

      if (password !== correctPassword) {
        return sendJson(res, 401, { error: 'Falsches Passwort / كلمة المرور غير صحيحة' });
      }

      const token = createSessionToken();
      const isProduction = process.env.NODE_ENV === 'production';
      const cookieHeader = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
        30 * 24 * 60 * 60
      }${isProduction ? '; Secure' : ''}`;

      return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
    } catch (err: any) {
      return sendJson(res, 500, { error: err?.message || 'Server error' });
    }
  }

  return sendJson(res, 405, { error: 'Method not allowed' });
}

export const GET = (req: Request) => handler(req);
export const POST = (req: Request) => handler(req);
