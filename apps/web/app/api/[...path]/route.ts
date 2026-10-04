import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const SESSION = 'smartcareer_session';
const AUTH_PATHS = new Set(['auth/login', 'auth/register', 'auth/me', 'auth/oauth/exchange', 'auth/dev-callback']);

function setSession(response: NextResponse, request: NextRequest, token: string) {
  const exp = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).exp;
  if (!Number.isSafeInteger(exp) || exp * 1000 <= Date.now()) throw new Error('Invalid session expiry');
  response.cookies.set(SESSION, token, {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: !['localhost', '127.0.0.1'].includes(request.nextUrl.hostname),
    maxAge: Math.max(0, Math.floor(exp - Date.now() / 1000)),
  });
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length || path.some(p => p === '.' || p === '..' || /[\/\\?#]/.test(p))) {
    return NextResponse.json({ message: 'Invalid API path' }, { status: 400 });
  }
  const endpoint = path.join('/');
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
  if (unsafe && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ message: 'Request origin is not allowed' }, { status: 403 });
  }
  if (endpoint === 'auth/logout' && request.method === 'POST') {
    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  }
  const migrating = endpoint === 'auth/session' && request.method === 'POST';
  if (path[0] === 'auth' && !AUTH_PATHS.has(endpoint) && !migrating) {
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  }
  try {
    const apiBase = (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL ||
      (process.env.NODE_ENV === 'production' ? 'https://smartcareerapi-production.up.railway.app/api' : 'http://localhost:4000/api')).replace(/\/$/, '');
    const upstreamUrl = apiBase + '/' + (migrating ? 'auth/me' : path.map(encodeURIComponent).join('/')) + request.nextUrl.search;
    const headers = new Headers({ 'Content-Type': request.headers.get('content-type') || 'application/json' });
    let token = request.cookies.get(SESSION)?.value;
    let body: ArrayBuffer | undefined;
    if (migrating) {
      const input = await request.json();
      if (typeof input.token !== 'string' || input.token.length > 8192) {
        return NextResponse.json({ message: 'Invalid session' }, { status: 400 });
      }
      token = input.token;
    } else if (unsafe) {
      body = await request.arrayBuffer();
      if (body.byteLength > 10 * 1024 * 1024) return NextResponse.json({ message: 'Payload too large' }, { status: 413 });
    }
    if (token) headers.set('Authorization', 'Bearer ' + token);
    if (unsafe) headers.set('Origin', request.nextUrl.origin);
    const upstream = await fetch(upstreamUrl, {
      method: migrating ? 'GET' : request.method, headers, body,
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(120000),
    });
    const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
    for (const name of ['content-type', 'content-disposition', 'x-content-type-options']) {
      const value = upstream.headers.get(name); if (value) responseHeaders.set(name, value);
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      return NextResponse.json({ message: 'Unexpected API redirect' }, { status: 502 });
    }
    if (upstream.headers.get('content-type')?.includes('application/json')) {
      const data = await upstream.json();
      let sessionToken: string | undefined;
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        sessionToken = typeof data.token === 'string' ? data.token : undefined;
        delete data.token;
      }
      const response = NextResponse.json(data, { status: upstream.status, headers: responseHeaders });
      if (upstream.ok && sessionToken && (migrating || ['auth/login', 'auth/register', 'auth/oauth/exchange', 'auth/dev-callback'].includes(endpoint))) {
        setSession(response, request, sessionToken);
      }
      if (upstream.status === 401 && endpoint === 'auth/me') {
        response.cookies.set(SESSION, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
      }
      return response;
    }
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ message: 'Unable to reach the service. Please try again.' }, { status: 502 });
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD };
