import { SESSION_COOKIE_NAME } from '../_auth';

export async function POST() {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieHeader = `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
    isProduction ? '; Secure' : ''
  }`;

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookieHeader
    }
  });
}
