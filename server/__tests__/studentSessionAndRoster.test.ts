// @vitest-environment node
/**
 * Tests for Phase 3 Student Authentication, Class Roster, Rate Limiting, and Scoping.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

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
  getClassByCode: vi.fn(),
  getClassesForSchool: vi.fn().mockResolvedValue([]),
  createClassWithUniqueCode: vi.fn(),
  archiveClassInDb: vi.fn().mockResolvedValue(undefined),
  getStudentsForClassRoster: vi.fn(),
  checkAndIncrementClassLookupRateLimit: vi.fn(),
  getStudentById: vi.fn(),
  unlockStudentPinInDb: vi.fn().mockResolvedValue(undefined),
  updateStudentPinInDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../studentPin', () => ({
  verifyStudentPin: vi.fn(),
  hashPin: vi.fn().mockResolvedValue('fake_hashed_pin'),
}));

import * as db from '../db';
import * as pinService from '../studentPin';
import { signStudentSession, STUDENT_SESSION_COOKIE } from '../auth';

const VALID_SECRET = 'test-secret-that-is-at-least-32-characters-long!!';

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
  headers?: Record<string, string>;
}): IncomingMessage & { body?: unknown } {
  return {
    method: opts.method,
    url: opts.url,
    headers: { cookie: opts.cookie ?? '', ...(opts.headers || {}) },
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

let handleApiRequest: typeof import('../apiHandler').handleApiRequest;

beforeEach(async () => {
  setEnv();
  vi.resetModules();
  const mod = await import('../apiHandler');
  handleApiRequest = mod.handleApiRequest;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Phase 3: GET /api/classes/by-code/:classCode', () => {
  it('returns first name + avatar only, never roll numbers or full names', async () => {
    vi.mocked(db.checkAndIncrementClassLookupRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
    });
    vi.mocked(db.getClassByCode).mockResolvedValue({
      id: 'cls_2a',
      school_id: 'sch_1',
      name: 'Class 2A',
      grade: 'Class 2',
      class_code: 'K7M9PX',
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    vi.mocked(db.getStudentsForClassRoster).mockResolvedValue([
      { id: 'stud_1', name: 'Kavitha', avatar: 'avatar_sun' },
      { id: 'stud_2', name: 'Ravi', avatar: 'avatar_star' },
    ]);

    const req = makeMockReq({ method: 'GET', url: '/api/classes/by-code/K7M9PX' });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const body = getBody(res) as {
      class: { id: string; name: string; classCode: string };
      students: Array<Record<string, unknown>>;
    };
    expect(body.class.name).toBe('Class 2A');
    expect(body.students.length).toBe(2);
    expect(body.students[0].name).toBe('Kavitha');
    expect(body.students[0].avatar).toBe('avatar_sun');
    // Must NEVER include roll numbers or full names
    expect(body.students[0].rollNo).toBeUndefined();
    expect(body.students[0].roll_no).toBeUndefined();
    expect(body.students[0].pin_hash).toBeUndefined();
  });

  it('rejects the Legacy class and archived classes with 404', async () => {
    vi.mocked(db.checkAndIncrementClassLookupRateLimit).mockResolvedValue({
      allowed: true,
      remaining: 19,
    });
    vi.mocked(db.getClassByCode).mockResolvedValue(null);

    const req = makeMockReq({ method: 'GET', url: '/api/classes/by-code/LEGACY' });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(404);
  });

  it('rate-limits lookups: returns 429 when IP limit is exceeded', async () => {
    vi.mocked(db.checkAndIncrementClassLookupRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
    });

    const req = makeMockReq({ method: 'GET', url: '/api/classes/by-code/K7M9PX' });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(429);
    expect((getBody(res) as Record<string, string>).error).toMatch(/Too many requests/i);
  });
});

describe('Phase 3: POST /api/student/login & Cookie isolation', () => {
  it('sets sara_student_session cookie (different name than admin cookie) on valid PIN', async () => {
    vi.mocked(db.getClassByCode).mockResolvedValue({
      id: 'cls_2a',
      school_id: 'sch_1',
      name: 'Class 2A',
      grade: 'Class 2',
      class_code: 'K7M9PX',
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    vi.mocked(db.getStudentById).mockResolvedValue({
      id: 'stud_1',
      school_id: 'sch_1',
      class_id: 'cls_2a',
      name: 'Kavitha Sundaram',
      roll_no: '01',
      avatar: 'avatar_sun',
      pin_hash: 'hash',
      failed_pin_attempts: 0,
      locked_until: null,
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      archived_at: null,
    });
    vi.mocked(pinService.verifyStudentPin).mockResolvedValue({
      success: true,
      student: {
        id: 'stud_1',
        name: 'Kavitha',
        schoolId: 'sch_1',
        classId: 'cls_2a',
        rollNo: '01',
        avatar: 'avatar_sun',
      },
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/student/login',
      body: {
        classCode: 'K7M9PX',
        studentId: 'stud_1',
        pin: ['sun', 'star', 'tree'],
      },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toBeDefined();
    // Must be student cookie name, NOT admin cookie name
    expect(setCookie).toContain(STUDENT_SESSION_COOKIE);
    expect(setCookie).not.toContain('sara_admin_session');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Strict');

    const body = getBody(res) as { success: boolean; student: { name: string } };
    expect(body.success).toBe(true);
    expect(body.student.name).toBe('Kavitha');
  });

  it('returns 423 when student account is locked after 5 failed PIN attempts', async () => {
    vi.mocked(db.getClassByCode).mockResolvedValue({
      id: 'cls_2a',
      school_id: 'sch_1',
      name: 'Class 2A',
      grade: 'Class 2',
      class_code: 'K7M9PX',
      created_at: new Date().toISOString(),
      archived_at: null,
    });
    vi.mocked(db.getStudentById).mockResolvedValue({
      id: 'stud_1',
      school_id: 'sch_1',
      class_id: 'cls_2a',
      name: 'Kavitha',
      roll_no: '01',
      avatar: 'avatar_sun',
      pin_hash: 'hash',
      failed_pin_attempts: 5,
      locked_until: new Date(Date.now() + 1000000).toISOString(),
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      archived_at: null,
    });
    vi.mocked(pinService.verifyStudentPin).mockResolvedValue({
      success: false,
      error: 'Account locked due to too many failed attempts.',
      locked: true,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/student/login',
      body: {
        classCode: 'K7M9PX',
        studentId: 'stud_1',
        pin: ['sun', 'star', 'tree'],
      },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(423);
    const body = getBody(res) as { locked: boolean };
    expect(body.locked).toBe(true);
  });
});

describe('Phase 3: Student Data Scoping — Student A cannot read or write Student B', () => {
  it('Student A can read own progress, but CANNOT read Student B (returns 403)', async () => {
    const studentAToken = await signStudentSession({
      studentId: 'student_A',
      schoolId: 'sch_1',
      classId: 'cls_1',
    });

    // 1. Student A reads own progress -> 200
    vi.mocked(db.getProgressForStudentFromDb).mockResolvedValue([]);
    const reqOwn = makeMockReq({
      method: 'GET',
      url: '/api/students/student_A/progress',
      cookie: `${STUDENT_SESSION_COOKIE}=${studentAToken}`,
    });
    const resOwn = makeMockRes();
    await handleApiRequest(reqOwn, resOwn);
    expect(getStatus(resOwn)).toBe(200);

    // 2. Student A attempts to read Student B's progress -> 403 Forbidden!
    const reqB = makeMockReq({
      method: 'GET',
      url: '/api/students/student_B/progress',
      cookie: `${STUDENT_SESSION_COOKIE}=${studentAToken}`,
    });
    const resB = makeMockRes();
    await handleApiRequest(reqB, resB);
    expect(getStatus(resB)).toBe(403);
    expect((getBody(resB) as Record<string, string>).error).toMatch(/Access denied/i);
  });

  it('Student A CANNOT write an attempt for Student B (returns 403)', async () => {
    const studentAToken = await signStudentSession({
      studentId: 'student_A',
      schoolId: 'sch_1',
      classId: 'cls_1',
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/students/student_B/attempts',
      cookie: `${STUDENT_SESSION_COOKIE}=${studentAToken}`,
      body: {
        activityId: 'FTS0001',
        category: 'word-completion',
        result: 'correct',
        completed: true,
      },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(403);
    expect((getBody(res) as Record<string, string>).error).toMatch(/Access denied/i);
    // Verified: recordAttemptInDb was never called
    expect(db.recordAttemptInDb).not.toHaveBeenCalled();
  });
});

describe('Phase 3: Student Logout & Desktop Hygiene', () => {
  it('POST /api/student/logout clears the student session cookie', async () => {
    const req = makeMockReq({ method: 'POST', url: '/api/student/logout' });
    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(getStatus(res)).toBe(200);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain(STUDENT_SESSION_COOKIE);
    expect(setCookie).toContain('Max-Age=0');
  });
});

