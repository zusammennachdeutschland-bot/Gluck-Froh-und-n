import { sendJson, SESSION_COOKIE_NAME } from '../_auth.js';

export default async function handler(_req: any, res?: any) {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    isProduction ? '; Secure' : ''
  }`;

  return sendJson(res, 200, { success: true }, { 'Set-Cookie': cookieHeader });
}

export const POST = (req: Request) => handler(req);
