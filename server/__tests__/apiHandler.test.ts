// @vitest-environment node
/**
 * Tests for the API handler — auth middleware, login, lockout, protected routes.
 *
 * These tests do NOT hit a real database. The db module is mocked.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

// ── Mock db module ────────────────────────────────────────────────────────────
vi.mock('../db', () => ({
  getDb: vi.fn(),
  getStudentsFromDb: vi.fn().mockResolvedValue([]),
  upsertStudentInDb: vi.fn().mockResolvedValue(undefined),
  deleteStudentFromDb: vi.fn().mockResolvedValue(undefined),
  archiveStudentInDb: vi.fn().mockResolvedValue(undefined),
  getProgressForStudentFromDb: vi.fn().mockResolvedValue([]),
  recordAttemptInDb: vi.fn().mockResolvedValue({ status: 'recorded' }),
  getAttemptsForStudentFromDb: vi.fn().mockResolvedValue([]),
  getAdminByUsername: vi.fn(),
  incrementAdminFailedAttempts: vi.fn().mockResolvedValue(undefined),
  resetAdminFailedAttempts: vi.fn().mockResolvedValue(undefined),
}));

import * as db from '../db';
import { signAdminSession } from '../auth';

const VALID_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

// ── Helpers ───────────────────────────────────────────────────────────────────
function setEnv() {
  process.env.SESSION_SECRET = VALID_SECRET;
  process.env.DATABASE_URL = 'postgresql://fake:fake@fake/fake';
}

interface MockRes {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}

function makeMockRes(): ServerResponse & MockRes {
  const state = { statusCode: 200, headers: {} as Record<string, string | string[]>, body: '' };
  const mock = {
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    get headers() { return state.headers; },
    get body() { return state.body; },
    setHeader(name: string, value: string) { state.headers[name] = value; },
    end(data?: string) { if (data) state.body += data; },
  };
  return mock as unknown as ServerResponse & MockRes;
}

function makeMockReq(opts: {
  method: string;
  url: string;
  cookie?: string;
  body?: unknown;
}): IncomingMessage & { body?: unknown } {
  return {
    method: opts.method,
    url: opts.url,
    headers: { cookie: opts.cookie ?? '' },
    body: opts.body,
    on: vi.fn(),
  } as unknown as IncomingMessage & { body?: unknown };
}

function getBody(res: ServerResponse & MockRes): unknown {
  return JSON.parse(res.body || '{}');
}

function getStatus(res: ServerResponse & MockRes): number {
  return res.statusCode;
}

// ── Import handler after mocks ────────────────────────────────────────────────
// We import dynamically to ensure mocks are set up first
let handleApiRequest: typeof import('../apiHandler').handleApiRequest;

beforeEach(async () => {
  setEnv();
  vi.resetModules();
  // Re-import after resetting to pick up fresh module state
  const mod = await import('../apiHandler');
  handleApiRequest = mod.handleApiRequest;
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('GET /api/health — public', () => {
  it('returns 200 {status, database} without auth', async () => {
    vi.mocked(db.getDb).mockReturnValue({
      query: vi.fn().mockResolvedValue([]),
    } as unknown as ReturnType<typeof db.getDb>);

    const req = makeMockReq({ method: 'GET', url: '/api/health' });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const body = getBody(res) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    // Must NOT expose internal details
    expect(body.branch).toBeUndefined();
    expect(body.provider).toBeUndefined();
  });
});

describe('POST /api/admin/login', () => {
  it('returns 401 with generic message for unknown user', async () => {
    vi.mocked(db.getAdminByUsername).mockResolvedValue(null);

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/login',
      body: { username: 'nobody', password: 'wrongpassword' },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(401);
    expect((getBody(res) as Record<string, string>).error).toBe('Invalid username or password');
  });

  it('returns 401 with same message for wrong password on existing user', async () => {
    vi.mocked(db.getAdminByUsername).mockResolvedValue({
      id: 'adm_1',
      username: 'admin',
      // bcrypt hash of 'wrongpassword' — password won't match 'correctpassword'
      password_hash: '$2a$12$notavalidhashbutlongenoughaaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'super_admin',
      school_id: null,
      failed_attempts: 0,
      locked_until: null,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/login',
      body: { username: 'admin', password: 'wrongpassword' },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(401);
    expect((getBody(res) as Record<string, string>).error).toBe('Invalid username or password');
  });

  it('returns 401 for a locked account without revealing lockout reason', async () => {
    const futureDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    vi.mocked(db.getAdminByUsername).mockResolvedValue({
      id: 'adm_1',
      username: 'admin',
      password_hash: '$2a$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      role: 'super_admin',
      school_id: null,
      failed_attempts: 5,
      locked_until: futureDate,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/login',
      body: { username: 'admin', password: 'anypassword' },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(401);
    // Same generic message — no lockout details exposed
    expect((getBody(res) as Record<string, string>).error).toBe('Invalid username or password');
  });

  it('returns 400 for missing password field', async () => {
    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/login',
      body: { username: 'admin' }, // missing password
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(400);
  });
});

describe('Protected routes — require admin session', () => {
  it('GET /api/students returns 401 without cookie', async () => {
    const req = makeMockReq({ method: 'GET', url: '/api/students' });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(401);
  });

  it('DELETE /api/students/:id returns 401 without cookie', async () => {
    const req = makeMockReq({ method: 'DELETE', url: '/api/students/abc123' });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(401);
  });

  it('GET /api/students/:id/progress returns 401 without cookie', async () => {
    const req = makeMockReq({ method: 'GET', url: '/api/students/abc/progress' });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(401);
  });

  it('GET /api/students returns 200 with valid admin cookie', async () => {
    vi.mocked(db.getStudentsFromDb).mockResolvedValue([]);

    const token = await signAdminSession({
      sub: 'adm_1',
      username: 'admin',
      role: 'super_admin',
      schoolId: null,
    });

    const req = makeMockReq({
      method: 'GET',
      url: '/api/students',
      cookie: `sara_admin_session=${token}`,
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const body = getBody(res) as { students: unknown[] };
    expect(Array.isArray(body.students)).toBe(true);
  });

  it('treats missing school_id on a school_admin as DENY (403), never as all', async () => {
    const token = await signAdminSession({
      sub: 'adm_unscoped',
      username: 'rogue_admin',
      role: 'school_admin',
      schoolId: null, // missing school_id
    });

    const req = makeMockReq({
      method: 'GET',
      url: '/api/students',
      cookie: `sara_admin_session=${token}`,
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(403);
    const body = getBody(res) as { error: string };
    expect(body.error).toMatch(/Access denied/i);
    // Verified: getStudentsFromDb was NOT called with all
    expect(db.getStudentsFromDb).not.toHaveBeenCalled();
  });
});

describe('GET /api/admin/session — public', () => {
  it('returns 401 without cookie', async () => {
    const req = makeMockReq({ method: 'GET', url: '/api/admin/session' });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(401);
  });

  it('returns 200 with user info for valid cookie', async () => {
    const token = await signAdminSession({
      sub: 'adm_1',
      username: 'schooladmin',
      role: 'school_admin',
      schoolId: 'sch_1',
    });

    const req = makeMockReq({
      method: 'GET',
      url: '/api/admin/session',
      cookie: `sara_admin_session=${token}`,
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const body = getBody(res) as { user: { username: string; role: string } };
    expect(body.user.username).toBe('schooladmin');
    expect(body.user.role).toBe('school_admin');
  });
});

describe('Validation — malformed bodies', () => {
  it('POST /api/students with empty body returns 400', async () => {
    const token = await signAdminSession({
      sub: 'adm_1',
      username: 'admin',
      role: 'super_admin',
      schoolId: null,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/students',
      cookie: `sara_admin_session=${token}`,
      body: {},
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(getStatus(res)).toBe(400);
  });
});
