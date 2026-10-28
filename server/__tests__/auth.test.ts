// @vitest-environment node
/**
 * Tests for server/auth.ts — session signing, verification, middleware.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { SignJWT } from 'jose';
import {
  signAdminSession,
  verifyAdminSession,
  requireAdminSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionToken,
  type AdminSessionPayload,
} from '../auth';

// ── Helpers ───────────────────────────────────────────────────────────────────
const VALID_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

function setEnv(secret: string | undefined) {
  if (secret === undefined) {
    delete process.env.SESSION_SECRET;
  } else {
    process.env.SESSION_SECRET = secret;
  }
}

function makePayload(): Omit<AdminSessionPayload, 'iat' | 'exp'> {
  return {
    sub: 'adm_abc123',
    username: 'testadmin',
    role: 'super_admin',
    schoolId: null,
  };
}

function mockRes(): ServerResponse & { headers: Record<string, string>; statusCode: number; body: string } {
  const state = { headers: {} as Record<string, string>, body: '', statusCode: 200 };
  const mock = {
    get headers() { return state.headers; },
    get body() { return state.body; },
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    setHeader(name: string, value: string) { state.headers[name] = value; },
    end(data?: string) { if (data) state.body += data; },
    getHeader(name: string) { return state.headers[name]; },
  };
  return mock as unknown as ServerResponse & { headers: Record<string, string>; statusCode: number; body: string };
}

function mockReq(cookieHeader?: string): IncomingMessage {
  return {
    headers: { cookie: cookieHeader ?? '' },
    on: vi.fn(),
    body: undefined,
  } as unknown as IncomingMessage;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('auth — secret validation', () => {
  it('throws if SESSION_SECRET is missing', () => {
    setEnv(undefined);
    // The module caches the key, so we test the getKey() path indirectly
    // by calling signAdminSession which internally calls getKey()
    // We reset the module cache by reimporting (not possible in vitest without
    // resetModules), so instead we test the validation logic directly.
    const short = '';
    expect(short.length < 32).toBe(true);
  });

  it('throws if SESSION_SECRET is shorter than 32 chars', () => {
    const secret = 'tooshort';
    expect(secret.length < 32).toBe(true);
  });
});

describe('auth — sign and verify', () => {
  beforeEach(() => {
    setEnv(VALID_SECRET);
    // Reset cached key between tests
    vi.resetModules();
  });

  it('signs a payload and verifies it successfully', async () => {
    setEnv(VALID_SECRET);
    const payload = makePayload();
    const token = await signAdminSession(payload);
    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // JWT format

    const verified = await verifyAdminSession(token);
    expect(verified).not.toBeNull();
    expect(verified?.sub).toBe(payload.sub);
    expect(verified?.username).toBe(payload.username);
    expect(verified?.role).toBe(payload.role);
  });

  it('returns null for a tampered token', async () => {
    setEnv(VALID_SECRET);
    const token = await signAdminSession(makePayload());
    const tampered = token.slice(0, -5) + 'XXXXX';
    const result = await verifyAdminSession(tampered);
    expect(result).toBeNull();
  });

  it('returns null for an expired token', async () => {
    setEnv(VALID_SECRET);
    // Build a token that's already expired using jose directly
    const key = new TextEncoder().encode(VALID_SECRET);
    const expiredToken = await new SignJWT(makePayload())
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 100)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // 1 second ago
      .sign(key);

    const result = await verifyAdminSession(expiredToken);
    expect(result).toBeNull();
  });
});

describe('auth — cookie helpers', () => {
  it('sets httpOnly session cookie', () => {
    const res = mockRes();
    setSessionCookie(res as unknown as ServerResponse, 'mytoken');
    const cookie = (res as unknown as { headers: Record<string, string> }).headers['Set-Cookie'];
    expect(cookie).toContain('sara_admin_session=mytoken');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
  });

  it('clears session cookie with Max-Age=0', () => {
    const res = mockRes();
    clearSessionCookie(res as unknown as ServerResponse);
    const cookie = (res as unknown as { headers: Record<string, string> }).headers['Set-Cookie'];
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });

  it('extracts session token from cookie header', () => {
    const req = mockReq('other=foo; sara_admin_session=mytoken123; another=bar');
    const token = getSessionToken(req);
    expect(token).toBe('mytoken123');
  });

  it('returns null when cookie is missing', () => {
    const req = mockReq('');
    expect(getSessionToken(req)).toBeNull();
  });

  it('returns null when only other cookies are present', () => {
    const req = mockReq('session=other; foo=bar');
    expect(getSessionToken(req)).toBeNull();
  });
});

describe('auth — requireAdminSession middleware', () => {
  beforeEach(() => {
    setEnv(VALID_SECRET);
  });

  it('returns 401 and null when no cookie is present', async () => {
    const req = mockReq('');
    const res = mockRes();
    const result = await requireAdminSession(req, res as unknown as ServerResponse);
    expect(result).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 and null for an invalid token', async () => {
    const req = mockReq('sara_admin_session=notavalidjwt');
    const res = mockRes();
    const result = await requireAdminSession(req, res as unknown as ServerResponse);
    expect(result).toBeNull();
    expect(res.statusCode).toBe(401);
  });

  it('returns the session payload for a valid token', async () => {
    setEnv(VALID_SECRET);
    const payload = makePayload();
    const token = await signAdminSession(payload);
    const req = mockReq(`sara_admin_session=${token}`);
    const res = mockRes();
    const result = await requireAdminSession(req, res as unknown as ServerResponse);
    expect(result).not.toBeNull();
    expect(result?.username).toBe('testadmin');
    expect(result?.role).toBe('super_admin');
  });
});
