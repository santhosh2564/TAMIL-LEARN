// @vitest-environment node
/**
 * T5. School admin of school X gets 403 when:
 * 1. Creating a class targeting school Y
 * 2. Adding a student to a class in school Y
 * 3. Resetting a PIN for a student in school Y
 * 4. Unlocking a student in school Y
 * 5. Fetching cards for a class in school Y
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

vi.mock('../db', () => ({
  getDb: vi.fn(),
  getClassById: vi.fn(),
  getStudentById: vi.fn(),
  createClassWithUniqueCode: vi.fn(),
  upsertStudentInDb: vi.fn(),
  updateStudentPinInDb: vi.fn(),
  unlockStudentPinInDb: vi.fn(),
  getStudentsForClassRoster: vi.fn(),
}));

import * as db from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession } from '../auth';

interface MockRes {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: string;
}

function makeMockRes(): ServerResponse & MockRes {
  const state = { statusCode: 200, headers: {} as Record<string, string | string[]>, body: '' };
  return {
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    get headers() { return state.headers; },
    get body() { return state.body; },
    setHeader(name: string, value: string) { state.headers[name] = value; },
    end(data?: string) { if (data) state.body += data; },
  } as unknown as ServerResponse & MockRes;
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
    headers: { cookie: opts.cookie || '' },
    body: opts.body,
    on: vi.fn(),
  } as unknown as IncomingMessage & { body?: unknown };
}

describe('T5: School admin cross-school isolation (403 on foreign school actions)', () => {
  const SCHOOL_X = 'school_X';
  const SCHOOL_Y = 'school_Y';
  let adminXCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://fake:fake@fake/fake';
    vi.clearAllMocks();

    const token = await signAdminSession({
      sub: 'admin_X',
      username: 'teacher_x',
      role: 'school_admin',
      schoolId: SCHOOL_X,
    });
    adminXCookie = `sara_admin_session=${token}`;
  });

  it('1. returns 403 when school admin X attempts to create a class in school Y', async () => {
    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/classes',
      cookie: adminXCookie,
      body: { name: 'Class 3B', grade: 'Class 3', schoolId: SCHOOL_Y },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(res.statusCode, 'Creating a class in school Y must return 403').toBe(403);
  });

  it('2. returns 403 when school admin X attempts to add a student to a class in school Y', async () => {
    // Class belongs to school Y
    vi.mocked(db.getClassById).mockResolvedValue({
      id: 'cls_Y',
      school_id: SCHOOL_Y,
      name: 'Class Y',
      grade: 'Class 3',
      class_code: 'CLSY01',
      created_at: new Date().toISOString(),
      archived_at: null,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/students',
      cookie: adminXCookie,
      body: {
        classId: 'cls_Y',
        name: 'Student In School Y',
        rollNo: '01',
        avatar: 'avatar_sun',
        pin: ['sun', 'star', 'tree'],
      },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(res.statusCode, 'Adding a student to class in school Y must return 403').toBe(403);
  });

  it('3. returns 403 when school admin X attempts to reset PIN for a student in school Y', async () => {
    vi.mocked(db.getStudentById).mockResolvedValue({
      id: 'stud_Y',
      school_id: SCHOOL_Y,
      class_id: 'cls_Y',
      name: 'Kavin',
      roll_no: '01',
      avatar: 'avatar_sun',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      pin_hash: 'hash',
      failed_pin_attempts: 0,
      locked_until: null,
      archived_at: null,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/students/stud_Y/reset-pin',
      cookie: adminXCookie,
      body: { pin: ['car', 'apple', 'sun'] },
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(res.statusCode, 'Resetting PIN for student in school Y must return 403').toBe(403);
  });

  it('4. returns 403 when school admin X attempts to unlock a student in school Y', async () => {
    vi.mocked(db.getStudentById).mockResolvedValue({
      id: 'stud_Y',
      school_id: SCHOOL_Y,
      class_id: 'cls_Y',
      name: 'Kavin',
      roll_no: '01',
      avatar: 'avatar_sun',
      created_at: new Date().toISOString(),
      last_active_at: new Date().toISOString(),
      pin_hash: 'hash',
      failed_pin_attempts: 5,
      locked_until: new Date(Date.now() + 600000).toISOString(),
      archived_at: null,
    });

    const req = makeMockReq({
      method: 'POST',
      url: '/api/admin/students/stud_Y/unlock',
      cookie: adminXCookie,
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(res.statusCode, 'Unlocking student in school Y must return 403').toBe(403);
  });

  it('5. returns 403 when school admin X attempts to fetch cards for a class in school Y', async () => {
    vi.mocked(db.getClassById).mockResolvedValue({
      id: 'cls_Y',
      school_id: SCHOOL_Y,
      name: 'Class Y',
      grade: 'Class 3',
      class_code: 'CLSY01',
      created_at: new Date().toISOString(),
      archived_at: null,
    });

    const req = makeMockReq({
      method: 'GET',
      url: '/api/admin/classes/cls_Y/cards',
      cookie: adminXCookie,
    });
    const res = makeMockRes();
    await handleApiRequest(req, res);
    expect(res.statusCode, 'Fetching cards for class in school Y must return 403').toBe(403);
  });
});
