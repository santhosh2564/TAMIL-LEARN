// @vitest-environment node
/**
 * T11. Every route that reads or writes one student's data is school-scoped
 * (real Postgres, TEST_DATABASE_URL):
 * - school_admin of school X gets 403 on every /api/students/:id route for a student in
 *   school Y (and for an id that does not exist), and nothing is written.
 * - The same school_admin gets 2xx for a student in its own school.
 * - super_admin gets 2xx for the school Y student.
 * - A student session can read and write only its own data.
 * - POST /api/students and POST /api/sync no longer exist.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { runMigrations, setDb } from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession, signStudentSession, STUDENT_SESSION_COOKIE } from '../auth';
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
const schoolX = `sch_t11x_${suffix}`;
const schoolY = `sch_t11y_${suffix}`;
const classX = `cls_t11x_${suffix}`;
const classY = `cls_t11y_${suffix}`;
const studentX = `stud_t11x_${suffix}`;
const studentY = `stud_t11y_${suffix}`;
const sessionX = `sess_t11x_${suffix}`;
const sessionY = `sess_t11y_${suffix}`;
const missingStudent = `stud_t11_missing_${suffix}`;

/** Every /api/students/:id route, for a given student and that student's session id. */
function studentRoutes(studentId: string, sessionId: string, tag: string) {
  return [
    { method: 'GET', url: `/api/students/${studentId}/progress` },
    { method: 'GET', url: `/api/students/${studentId}/attempts` },
    {
      method: 'POST',
      url: `/api/students/${studentId}/attempts`,
      body: { id: `att_t11_${tag}_${suffix}`, activityId: 'FTS0147', result: 'correct', completed: true },
    },
    { method: 'GET', url: `/api/students/${studentId}/sessions/active` },
    {
      method: 'POST',
      url: `/api/students/${studentId}/sessions`,
      body: { subject: 'english', categoryOrModule: `t11-${tag}`, activityIds: ['ENG-M1-EW021', 'ENG-M1-EW002'] },
    },
    { method: 'PATCH', url: `/api/students/${studentId}/sessions/${sessionId}`, body: { currentIndex: 1 } },
  ];
}

suiteDescribe('T11: /api/students/:id routes are school-scoped (real Postgres)', () => {
  let sql: NeonQueryFunction<false, false>;
  let adminXCookie: string;
  let superCookie: string;
  let studentXCookie: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);

    for (const [school, cls, student, session] of [
      [schoolX, classX, studentX, sessionX],
      [schoolY, classY, studentY, sessionY],
    ]) {
      await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'T11 School');`, [school]);
      await sql.query(
        `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3', 'Class 3', $3);`,
        [cls, school, generateClassCode()]
      );
      await sql.query(
        `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'Original Name', '01', 'avatar_1');`,
        [student, school, cls]
      );
      await sql.query(
        `INSERT INTO learning_sessions (id, school_id, student_id, subject, category_or_module, activity_ids)
         VALUES ($1, $2, $3, 'tamil', 't11-seed', '["FTS0001","FTS0002","FTS0003"]'::jsonb);`,
        [session, school, student]
      );
    }

    adminXCookie = `sara_admin_session=${await signAdminSession({
      sub: 'admin_t11_x',
      username: 'teacher_x',
      role: 'school_admin',
      schoolId: schoolX,
    })}`;
    superCookie = `sara_admin_session=${await signAdminSession({
      sub: 'admin_t11_super',
      username: 'super',
      role: 'super_admin',
      schoolId: null,
    })}`;
    studentXCookie = `${STUDENT_SESSION_COOKIE}=${await signStudentSession({
      studentId: studentX,
      schoolId: schoolX,
      classId: classX,
    })}`;
  }, 60000);

  afterAll(async () => {
    const students = [studentX, studentY, missingStudent];
    await sql.query('DELETE FROM attempts WHERE student_id = ANY($1);', [students]);
    await sql.query('DELETE FROM activity_progress WHERE student_id = ANY($1);', [students]);
    await sql.query('DELETE FROM learning_sessions WHERE student_id = ANY($1);', [students]);
    await sql.query('DELETE FROM students WHERE id = ANY($1);', [students]);
    await sql.query('DELETE FROM classes WHERE id = ANY($1);', [[classX, classY]]);
    await sql.query('DELETE FROM schools WHERE id = ANY($1);', [[schoolX, schoolY]]);
    setDb(null);
  });

  async function studentYUntouched() {
    const attempts = (await sql.query('SELECT count(*)::int AS n FROM attempts WHERE student_id = $1;', [studentY])) as {
      n: number;
    }[];
    const sessions = (await sql.query(
      'SELECT count(*)::int AS n FROM learning_sessions WHERE student_id = $1;',
      [studentY]
    )) as { n: number }[];
    const seeded = (await sql.query('SELECT current_index FROM learning_sessions WHERE id = $1;', [sessionY])) as {
      current_index: number;
    }[];
    const student = (await sql.query('SELECT name, archived_at FROM students WHERE id = $1;', [studentY])) as {
      name: string;
      archived_at: string | null;
    }[];
    expect(attempts[0].n).toBe(0);
    expect(sessions[0].n).toBe(1);
    expect(seeded[0].current_index).toBe(0);
    expect(student[0]).toEqual({ name: 'Original Name', archived_at: null });
  }

  it('school_admin X gets 403 on every /api/students/:id route for a school Y student, and nothing is written', async () => {
    const results: Record<string, number> = {};
    for (const r of [...studentRoutes(studentY, sessionY, 'adminx'), { method: 'DELETE', url: `/api/students/${studentY}` }]) {
      results[`${r.method} ${r.url}`] = await call(r.method, r.url, adminXCookie, (r as { body?: unknown }).body);
    }
    expect(results).toEqual(Object.fromEntries(Object.keys(results).map((k) => [k, 403])));
    await studentYUntouched();
  });

  it('school_admin X gets 403 for a student id that does not exist', async () => {
    expect(await call('GET', `/api/students/${missingStudent}/attempts`, adminXCookie)).toBe(403);
    expect(await call('GET', `/api/students/${missingStudent}/progress`, adminXCookie)).toBe(403);
  });

  it('POST /api/students and POST /api/sync no longer exist (404 even for super_admin)', async () => {
    expect(await call('POST', '/api/students', superCookie, { id: studentY, name: 'Renamed' })).toBe(404);
    expect(await call('POST', '/api/sync', superCookie, { students: [] })).toBe(404);
    await studentYUntouched();
  });

  it('school_admin X gets 2xx on every route for its own school X student', async () => {
    for (const r of studentRoutes(studentX, sessionX, 'adminx-own')) {
      const status = await call(r.method, r.url, adminXCookie, (r as { body?: unknown }).body);
      expect([200, 201], `${r.method} ${r.url} -> ${status}`).toContain(status);
    }
  });

  it('super_admin gets 2xx on every route for the school Y student', async () => {
    for (const r of [...studentRoutes(studentY, sessionY, 'super'), { method: 'DELETE', url: `/api/students/${studentY}` }]) {
      const status = await call(r.method, r.url, superCookie, (r as { body?: unknown }).body);
      expect([200, 201], `${r.method} ${r.url} -> ${status}`).toContain(status);
    }
  });

  it('a student session reads and writes only its own data', async () => {
    expect(await call('GET', `/api/students/${studentX}/attempts`, studentXCookie)).toBe(200);
    expect(await call('GET', `/api/students/${studentX}/progress`, studentXCookie)).toBe(200);
    for (const r of [...studentRoutes(studentY, sessionY, 'studx'), { method: 'DELETE', url: `/api/students/${studentY}` }]) {
      const status = await call(r.method, r.url, studentXCookie, (r as { body?: unknown }).body);
      expect([401, 403], `${r.method} ${r.url} -> ${status}`).toContain(status);
    }
  });
});
