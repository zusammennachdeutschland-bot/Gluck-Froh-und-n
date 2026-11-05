import { createSessionToken, getTeacherPassword, isTeacherAuthenticated, SESSION_COOKIE_NAME } from '../_auth';

export async function POST(req: Request) {
  try {
    const { password } = await req.json();
    const correctPassword = getTeacherPassword();

    if (password !== correctPassword) {
      return new Response(JSON.stringify({ error: 'Falsches Passwort / Incorrect password' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const token = createSessionToken();
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieHeader = `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${
      30 * 24 * 60 * 60
    }${isProduction ? '; Secure' : ''}`;

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': cookieHeader
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(req: Request) {
  const authed = isTeacherAuthenticated(req);
  return new Response(JSON.stringify({ authenticated: authed }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}
