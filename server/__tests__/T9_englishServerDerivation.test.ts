// @vitest-environment node
/**
 * T9. Server derives subject='english' and module_id from content manifests by activity_id:
 * - Never trusts client-supplied subject or module_id values.
 * - Stores derived subject and module_id in the attempts table.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

vi.mock('../db', () => ({
  getDb: vi.fn(),
  recordAttemptInDb: vi.fn(),
}));

import * as db from '../db';
import { handleApiRequest } from '../apiHandler';
import { signStudentSession, STUDENT_SESSION_COOKIE } from '../auth';

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

describe('T9: Server-side derivation of subject and module_id for attempts', () => {
  const studentId = 'stud_test_english';
  let studentCookie: string;

  beforeEach(async () => {
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://fake:fake@fake/fake';
    vi.clearAllMocks();

    const token = await signStudentSession({
      studentId,
      name: 'Kavin',
      schoolId: 'school_unassigned',
      classId: 'class_legacy',
    });
    studentCookie = `${STUDENT_SESSION_COOKIE}=${token}`;
  });

  it('derives subject="english" and module_id=1 for English activity c3-eng-m1-d1-q01, ignoring client spoofing', async () => {
    vi.mocked(db.recordAttemptInDb).mockResolvedValue({ status: 'recorded' });

    const req = makeMockReq({
      method: 'POST',
      url: `/api/students/${studentId}/attempts`,
      cookie: studentCookie,
      body: {
        id: 'att_eng_001',
        activityId: 'c3-eng-m1-d1-q01',
        // Client attempts to spoof or send bogus values:
        subject: 'bogus_math',
        moduleId: 999,
        attemptNumber: 1,
        result: 'correct',
        completed: true,
      },
    });

    const res = makeMockRes();
    await handleApiRequest(req, res);

    expect(res.statusCode).toBe(200);

    // Assert that recordAttemptInDb was called with SERVER-DERIVED metadata:
    expect(db.recordAttemptInDb).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'c3-eng-m1-d1-q01',
        subject: 'english',
        moduleId: 1,
      })
    );
  });
});
