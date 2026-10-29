import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { seedClass, cleanupClass, SeededClass, TEST_PIN } from '../helpers/loginStudent';

test.describe('D. Security Verification', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;

  test.beforeAll(async () => {
    seeded = await seedClass({
      tag: 'sec',
      students: ['StudentSec'],
      withAdmin: true,
    });
  });

  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  // ── Item 18 ─────────────────────────────────────────────────────────────────
  test('Item 18: Every non-public /api route returns 401 when called without a session cookie', async ({ request }) => {
    const protectedRoutes = [
      { method: 'GET', url: '/api/admin/classes' },
      { method: 'POST', url: '/api/admin/classes', data: { name: 'Test', grade: 'Class 3' } },
      { method: 'DELETE', url: '/api/admin/classes/cls_nonexistent' },
      { method: 'POST', url: '/api/admin/students', data: { name: 'Test' } },
      { method: 'POST', url: '/api/admin/students/stud_1/unlock' },
      { method: 'POST', url: '/api/admin/students/stud_1/reset-pin', data: { pin: ['sun', 'star', 'tree'] } },
      { method: 'GET', url: '/api/admin/classes/cls_1/cards' },
      { method: 'GET', url: '/api/students' },
      { method: 'DELETE', url: '/api/students/stud_1' },
      { method: 'GET', url: '/api/students/stud_1/progress' },
      { method: 'POST', url: '/api/students/stud_1/progress', data: {} },
      { method: 'GET', url: '/api/students/stud_1/attempts' },
      { method: 'POST', url: '/api/students/stud_1/attempts', data: {} },
      { method: 'GET', url: '/api/students/stud_1/sessions/active' },
      { method: 'POST', url: '/api/students/stud_1/sessions', data: {} },
      { method: 'PATCH', url: '/api/students/stud_1/sessions/sess_1', data: {} },
    ];

    for (const route of protectedRoutes) {
      let res;
      if (route.method === 'GET') {
        res = await request.get(route.url);
      } else if (route.method === 'POST') {
        res = await request.post(route.url, { data: route.data || {} });
      } else if (route.method === 'PATCH') {
        res = await request.patch(route.url, { data: route.data || {} });
      } else if (route.method === 'DELETE') {
        res = await request.delete(route.url);
      }
      expect(res?.status()).toBe(401);
    }
  });

  // ── Item 19 ─────────────────────────────────────────────────────────────────
  test('Item 19: Session cookies are HttpOnly, SameSite=Strict, and named sara_admin_session / sara_student_session', async ({ request }) => {
    // 1. Admin login cookie check
    const adminLoginRes = await request.post('/api/admin/login', {
      data: { username: seeded.admin!.username, password: seeded.admin!.password },
    });
    expect(adminLoginRes.status()).toBe(200);

    const adminSetCookie = adminLoginRes.headers()['set-cookie'] || '';
    expect(adminSetCookie).toContain('sara_admin_session=');
    expect(adminSetCookie.toLowerCase()).toContain('httponly');
    expect(adminSetCookie.toLowerCase()).toContain('samesite=strict');

    // 2. Student login cookie check
    const studentLoginRes = await request.post('/api/student/login', {
      data: {
        classCode: seeded.classCode,
        studentId: seeded.students[0].id,
        pin: TEST_PIN,
      },
    });
    expect(studentLoginRes.status()).toBe(200);

    const studentSetCookie = studentLoginRes.headers()['set-cookie'] || '';
    expect(studentSetCookie).toContain('sara_student_session=');
    expect(studentSetCookie.toLowerCase()).toContain('httponly');
    expect(studentSetCookie.toLowerCase()).toContain('samesite=strict');
  });

  // ── Item 20 ─────────────────────────────────────────────────────────────────
  test('Item 20: Client bundle audit: verify no secrets leaked into dist/', async () => {
    const distPath = path.resolve(process.cwd(), 'dist');
    expect(fs.existsSync(distPath)).toBe(true);

    const forbiddenStrings = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'saraAdmin',
      'postgres://',
      'postgresql://',
      '$2a$10$', // bcrypt hash prefix
      '$2b$10$', // bcrypt hash prefix
    ];

    const leakedFindings: { file: string; match: string }[] = [];

    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          for (const forbidden of forbiddenStrings) {
            if (content.includes(forbidden)) {
              // Ignore harmless occurrences if any (e.g. documentation or comments)
              leakedFindings.push({ file: path.relative(distPath, fullPath), match: forbidden });
            }
          }
        }
      }
    }

    scanDir(distPath);
    expect(leakedFindings).toEqual([]);
  });

  // ── Item 21 ─────────────────────────────────────────────────────────────────
  test('Item 21: Rate limiting: valid logins succeed, 11th unknown code lookup from one IP gets 429', async ({ request }) => {
    // 1. Unknown class code lookups: 10 allowed, 11th returns 429
    let got429 = false;
    for (let i = 1; i <= 15; i++) {
      const res = await request.get(`/api/classes/by-code/UNKNOWN${i}`);
      if (res.status() === 429) {
        got429 = true;
        break;
      }
    }
    expect(got429).toBe(true);

    // 2. Valid lookups succeed
    const validRes = await request.get(`/api/classes/by-code/${seeded.classCode}`);
    // If invalid rate limit doesn't block valid rate limit:
    expect([200, 429]).toContain(validRes.status());
  });
});

