// @vitest-environment node
/**
 * T1. Class lookup rate limit counts only NON-EXISTENT codes:
 * - 11th unknown-code lookup from one IP in 10 min -> 429.
 * - 50 valid-code lookups from one IP -> all 200.
 * - Valid codes limited at 300/10 min.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';

let mockCounts: Record<string, number> = {};

vi.mock('../db', () => ({
  getDb: vi.fn(),
  getClassByCode: vi.fn(),
  getStudentsForClassRoster: vi.fn().mockResolvedValue([]),
  checkAndRecordClassLookupRateLimit: vi.fn(),
  checkAndIncrementClassLookupRateLimit: vi.fn().mockImplementation((ip: string, kind: 'invalid' | 'valid') => {
    const key = `${ip}:${kind}`;
    mockCounts[key] = (mockCounts[key] || 0) + 1;
    const max = kind === 'invalid' ? 10 : 300;
    return Promise.resolve({ allowed: mockCounts[key] <= max, remaining: Math.max(0, max - mockCounts[key]) });
  }),
}));

import * as db from '../db';
import { handleApiRequest } from '../apiHandler';

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
  ip?: string;
}): IncomingMessage & { body?: unknown } {
  return {
    method: opts.method,
    url: opts.url,
    headers: { 'x-forwarded-for': opts.ip || '192.168.1.100' },
    on: vi.fn(),
  } as unknown as IncomingMessage & { body?: unknown };
}

describe('T1: Class lookup rate limit specification', () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = 'a'.repeat(32);
    process.env.DATABASE_URL = 'postgresql://fake:fake@fake/fake';
    mockCounts = {};
    vi.clearAllMocks();
  });

  it('allows 50 valid-code lookups from one IP without triggering rate limit (all 200)', async () => {
    vi.mocked(db.getClassByCode).mockResolvedValue({
      id: 'cls_1',
      school_id: 'sch_1',
      name: 'Class 3A',
      grade: 'Class 3',
      class_code: 'VALID1',
      created_at: new Date().toISOString(),
      archived_at: null,
    });

    for (let i = 1; i <= 50; i++) {
      const req = makeMockReq({ method: 'GET', url: '/api/classes/by-code/VALID1', ip: '10.0.0.1' });
      const res = makeMockRes();
      await handleApiRequest(req, res);
      expect(res.statusCode, `Lookup #${i} of valid code should return 200`).toBe(200);
    }
  });

  it('limits unknown-code lookups: 10 unknown codes return 404, 11th returns 429', async () => {
    vi.mocked(db.getClassByCode).mockResolvedValue(null);

    // 1st through 10th lookups for unknown codes should return 404
    for (let i = 1; i <= 10; i++) {
      const req = makeMockReq({ method: 'GET', url: `/api/classes/by-code/UNKNO${i}`, ip: '10.0.0.2' });
      const res = makeMockRes();
      await handleApiRequest(req, res);
      expect(res.statusCode, `Unknown lookup #${i} should return 404`).toBe(404);
    }

    // 11th lookup of an unknown code from the same IP must be rejected with 429
    const req11 = makeMockReq({ method: 'GET', url: '/api/classes/by-code/UNKNO11', ip: '10.0.0.2' });
    const res11 = makeMockRes();
    await handleApiRequest(req11, res11);
    expect(res11.statusCode, '11th unknown lookup from same IP must be 429').toBe(429);
  });
});
