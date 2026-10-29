// @vitest-environment node
/**
 * T12. Admin routes that act on one class or student return 404 when it does not exist
 * (or is archived), and 403 when it belongs to another school (403 takes priority):
 *   POST   /api/admin/students/:id/unlock
 *   POST   /api/admin/students/:id/reset-pin
 *   POST   /api/admin/students            (classId in body)
 *   DELETE /api/admin/classes/:id
 * Real Postgres (TEST_DATABASE_URL).
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { runMigrations, setDb } from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession } from '../auth';
import { generateClassCode } from '../classCode';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

if (testDbUrl && mainDbUrl && testDbUrl.trim() === mainDbUrl.trim()) {
  throw new Error('FATAL: TEST_DATABASE_URL must not equal DATABASE_URL. Real tests require an isolated test branch!');
}

const suiteDescribe = testDbUrl ? describe : describe.skip;

interface MockRes {
  statusCode: number;
  body: string;
}

function makeMockRes(): ServerResponse & MockRes {
  const state = { statusCode: 200, body: '' };
  return {
    get statusCode() { return state.statusCode; },
    set statusCode(v: number) { state.statusCode = v; },
    get body() { return state.body; },
    setHeader() {},
    end(data?: string) { if (data) state.body += data; },
  } as unknown as ServerResponse & MockRes;
}

async function call(method: string, url: string, cookie: string, body?: unknown): Promise<number> {
  const res = makeMockRes();
  await handleApiRequest(
    { method, url, headers: { cookie }, body, on: vi.fn() } as unknown as IncomingMessage & { body?: unknown },
    res
  );
  return res.statusCode;
}

const suffix = Date.now();
const schoolX = `sch_t12x_${suffix}`;
const schoolY = `sch_t12y_${suffix}`;
const classX = `cls_t12x_${suffix}`;
const classY = `cls_t12y_${suffix}`;
const archivedClassX = `cls_t12x_arch_${suffix}`;
const studentX = `stud_t12x_${suffix}`;
const studentY = `stud_t12y_${suffix}`;
const archivedStudentX = `stud_t12x_arch_${suffix}`;
const missing = `missing_t12_${suffix}`;
const newStudent = { name: 'New Kid', rollNo: '99', avatar: 'avatar_1', pin: ['sun', 'star', 'tree'] };

/** The four routes, aimed at a given student id and class id. */
function routes(studentId: string, classId: string) {
  return [
    { method: 'POST', url: `/api/admin/students/${studentId}/unlock` },
    { method: 'POST', url: `/api/admin/students/${studentId}/reset-pin`, body: { pin: ['fish', 'bird', 'car'] } },
    { method: 'POST', url: '/api/admin/students', body: { ...newStudent, classId } },
    { method: 'DELETE', url: `/api/admin/classes/${classId}` },
  ];
}

async function statuses(cookie: string, list: ReturnType<typeof routes>) {
  const out: Record<string, number> = {};
  for (const r of list) {
    out[`${r.method} ${r.url}${r.body && 'classId' in r.body ? ` classId=${r.body.classId}` : ''}`] = await call(
      r.method,
      r.url,
      cookie,
      r.body
    );
  }
  return out;
}

function allEqual(results: Record<string, number>, status: number) {
  return Object.fromEntries(Object.keys(results).map((k) => [k, status]));
}

suiteDescribe('T12: admin class/student routes return 404 for missing targets (real Postgres)', () => {
  let sql: NeonQueryFunction<false, false>;
  let adminXCookie: string;
  let superCookie: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);

    for (const [school, cls, student] of [
      [schoolX, classX, studentX],
      [schoolY, classY, studentY],
    ]) {
      await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'T12 School');`, [school]);
      await sql.query(
        `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3', 'Class 3', $3);`,
        [cls, school, generateClassCode()]
      );
      await sql.query(
        `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'T12 Kid', '01', 'avatar_1');`,
        [student, school, cls]
      );
    }
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code, archived_at) VALUES ($1, $2, 'Old', 'Class 3', $3, NOW());`,
      [archivedClassX, schoolX, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar, archived_at) VALUES ($1, $2, $3, 'Gone', '02', 'avatar_1', NOW());`,
      [archivedStudentX, schoolX, classX]
    );

    adminXCookie = `sara_admin_session=${await signAdminSession({
      sub: 'admin_t12_x',
      username: 'teacher_x',
      role: 'school_admin',
      schoolId: schoolX,
    })}`;
    superCookie = `sara_admin_session=${await signAdminSession({
      sub: 'admin_t12_super',
      username: 'super',
      role: 'super_admin',
      schoolId: null,
    })}`;
  }, 60000);

  afterAll(async () => {
    const schools = [schoolX, schoolY];
    await sql.query('DELETE FROM students WHERE school_id = ANY($1);', [schools]);
    await sql.query('DELETE FROM classes WHERE school_id = ANY($1);', [schools]);
    await sql.query('DELETE FROM schools WHERE id = ANY($1);', [schools]);
    setDb(null);
  });

  it('school_admin gets 404 for a class/student id that does not exist', async () => {
    const results = await statuses(adminXCookie, routes(missing, missing));
    expect(results).toEqual(allEqual(results, 404));
  });

  it('school_admin gets 404 for an archived class/student in its own school', async () => {
    const results = await statuses(adminXCookie, routes(archivedStudentX, archivedClassX));
    expect(results).toEqual(allEqual(results, 404));
  });

  it('super_admin gets 404 for a class/student id that does not exist', async () => {
    const results = await statuses(superCookie, routes(missing, missing));
    expect(results).toEqual(allEqual(results, 404));
  });

  it('school_admin gets 403 (not 404) for an existing class/student in another school', async () => {
    const results = await statuses(adminXCookie, routes(studentY, classY));
    expect(results).toEqual(allEqual(results, 403));
  });

  it('super_admin creating a student in school Y class stores it under school Y', async () => {
    const res = makeMockRes();
    await handleApiRequest(
      {
        method: 'POST',
        url: '/api/admin/students',
        headers: { cookie: superCookie },
        body: { ...newStudent, rollNo: '98', classId: classY },
        on: vi.fn(),
      } as unknown as IncomingMessage & { body?: unknown },
      res
    );
    expect(res.statusCode).toBe(201);
    const created = JSON.parse(res.body).student as { id: string; schoolId: string };
    expect(created.schoolId).toBe(schoolY);
    const rows = (await sql.query('SELECT school_id, class_id FROM students WHERE id = $1;', [created.id])) as {
      school_id: string;
      class_id: string;
    }[];
    expect(rows[0]).toEqual({ school_id: schoolY, class_id: classY });
  });

  it('school_admin gets 2xx for its own existing class/student', async () => {
    const list = routes(studentX, classX);
    for (const r of list) {
      const status = await call(r.method, r.url, adminXCookie, r.body);
      expect([200, 201], `${r.method} ${r.url} -> ${status}`).toContain(status);
    }
  });
});
