// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';
import handler, { reconstructRequestedUrl } from '../../api/index';

// Helper to mock IncomingMessage
function createMockRequest(url: string, method = 'GET', body?: unknown): IncomingMessage & { body?: unknown } {
  return {
    url,
    method,
    headers: {
      host: 'localhost',
    },
    body,
  } as unknown as IncomingMessage & { body?: unknown };
}

// Helper to mock ServerResponse
function createMockResponse(): ServerResponse & {
  statusCode: number;
  headers: Record<string, string>;
  data: string;
  isEnded: boolean;
} {
  const res: any = {
    statusCode: 200,
    headers: {},
    data: '',
    isEnded: false,
    writableEnded: false,
    setHeader(key: string, value: string) {
      res.headers[key.toLowerCase()] = value;
      return res;
    },
    end(chunk?: string) {
      if (chunk) res.data += chunk;
      res.isEnded = true;
      res.writableEnded = true;
      return res;
    },
  };
  return res;
}

describe('Vercel API Routing Reconstructor', () => {
  it('reconstructs single-segment paths correctly and strips __path', () => {
    const req = createMockRequest('/api/index?__path=health');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/health');
  });

  it('reconstructs nested multi-segment paths correctly', () => {
    const req = createMockRequest('/api/index?__path=public/schools');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/public/schools');
  });

  it('reconstructs deeply nested paths correctly', () => {
    const req = createMockRequest('/api/index?__path=admin/reports/students');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/admin/reports/students');
  });

  it('preserves query parameters while stripping internal __path', () => {
    const req = createMockRequest('/api/index?__path=admin/reports/students&page=2&limit=50&sort=desc');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/admin/reports/students?page=2&limit=50&sort=desc');
    expect(req.url).not.toContain('__path');
  });

  it('handles URL-encoded path segments correctly', () => {
    const req = createMockRequest('/api/index?__path=schools/Green%20Valley%20High/roster');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/schools/Green%20Valley%20High/roster');
  });

  it('handles direct invocations without __path (e.g. dev/preview server)', () => {
    const req = createMockRequest('/api/health');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/health');
  });

  it('normalizes missing leading /api for direct invocations', () => {
    const req = createMockRequest('/public/schools');
    reconstructRequestedUrl(req);
    expect(req.url).toBe('/api/public/schools');
  });
});

describe('Vercel API Serverless Handler Integration', () => {
  it('handles unknown nested routes with application-level JSON 404 (not platform 404)', async () => {
    const req = createMockRequest('/api/index?__path=unknown/nested&probe=abc', 'GET');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    const body = JSON.parse(res.data);
    expect(body.error).toMatch(/not found/i);
  });

  it('preserves POST method and body payload through the handler', async () => {
    const req = createMockRequest('/api/index?__path=admin/login', 'POST', {
      username: 'nonexistent-admin',
      password: 'wrong-password',
    });
    const res = createMockResponse();

    await handler(req, res);

    // Should reach the handler, parse body, and return auth failure (401), not 404 or 500
    expect(res.statusCode).toBe(401);
    expect(res.headers['content-type']).toContain('application/json');
    const body = JSON.parse(res.data);
    expect(body.error).toBe('Invalid username or password');
  });

  it('handles unauthenticated session requests with JSON 401', async () => {
    const req = createMockRequest('/api/index?__path=admin/session', 'GET');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.data);
    expect(body.error).toBe('Not authenticated');
  });

  it('handles unauthenticated student session requests with JSON 401', async () => {
    const req = createMockRequest('/api/index?__path=student/session', 'GET');
    const res = createMockResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.data);
    expect(body.error).toBe('No active student session');
  });
});
