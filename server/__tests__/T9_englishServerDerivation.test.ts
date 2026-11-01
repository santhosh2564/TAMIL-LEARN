// @vitest-environment node
/**
 * T9. The server derives subject, module_id and grade for every attempt by looking the
 * activity_id up in the content manifests, ignores whatever the client sends, and stores
 * the derived values in the attempts table. Runs against real Postgres (TEST_DATABASE_URL).
 *
 * Tamil IDs (FTS0147, Q129) carry no module number, so these cases fail if the server
 * parses the ID string instead of using the manifests.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { IncomingMessage, ServerResponse } from 'http';
import fs from 'fs';
import path from 'path';
import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { runMigrations, setDb, splitSqlStatements } from '../db';
import { handleApiRequest } from '../apiHandler';
import { signStudentSession, STUDENT_SESSION_COOKIE } from '../auth';
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

function makeMockReq(url: string, cookie: string, body: unknown): IncomingMessage & { body?: unknown } {
  return {
    method: 'POST',
    url,
    headers: { cookie },
    body,
    on: vi.fn(),
  } as unknown as IncomingMessage & { body?: unknown };
}

interface StoredAttempt {
  subject: string | null;
  module_id: number | null;
  grade: number | null;
}

suiteDescribe('T9: attempts store manifest-derived subject, module_id and grade (real Postgres)', () => {
  let sql: NeonQueryFunction<false, false>;
  const suffix = Date.now();
  const schoolId = `sch_t9_${suffix}`;
  const classId = `cls_t9_${suffix}`;
  const studentId = `stud_t9_${suffix}`;
  let studentCookie: string;

  beforeAll(async () => {
    process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'a'.repeat(32);
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);

    await sql.query(`INSERT INTO schools (id, name) VALUES ($1, 'T9 School');`, [schoolId]);
    await sql.query(
      `INSERT INTO classes (id, school_id, name, grade, class_code) VALUES ($1, $2, 'Class 3A', 'Class 3', $3);`,
      [classId, schoolId, generateClassCode()]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, class_id, name, roll_no, avatar) VALUES ($1, $2, $3, 'T9 Student', '01', 'avatar_1');`,
      [studentId, schoolId, classId]
    );

    const token = await signStudentSession({ studentId, schoolId, classId });
    studentCookie = `${STUDENT_SESSION_COOKIE}=${token}`;
  }, 60000);

  afterAll(async () => {
    await sql.query('DELETE FROM attempts WHERE student_id = $1;', [studentId]);
    await sql.query('DELETE FROM activity_progress WHERE student_id = $1;', [studentId]);
    await sql.query('DELETE FROM students WHERE id = $1;', [studentId]);
    await sql.query('DELETE FROM classes WHERE id = $1;', [classId]);
    await sql.query('DELETE FROM schools WHERE id = $1;', [schoolId]);
    setDb(null);
  });

  async function postAttempt(attemptId: string, activityId: string, spoof: Record<string, unknown>) {
    const res = makeMockRes();
    await handleApiRequest(
      makeMockReq(`/api/students/${studentId}/attempts`, studentCookie, {
        id: attemptId,
        activityId,
        attemptNumber: 1,
        result: 'correct',
        completed: true,
        ...spoof,
      }),
      res
    );
    expect(res.statusCode).toBe(200);
    const rows = (await sql.query('SELECT subject, module_id, grade FROM attempts WHERE id = $1;', [
      attemptId,
    ])) as StoredAttempt[];
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  it('English ENG-M1-EW021: stores subject=english, module_id=1, grade=3 despite client spoofing', async () => {
    const row = await postAttempt(`att_t9_eng_${suffix}`, 'ENG-M1-EW021', {
      subject: 'tamil',
      moduleId: 999,
      grade: 9,
    });
    expect(row).toEqual({ subject: 'english', module_id: 1, grade: 3 });
  });

  it('English ENG-M7-EW374: stores module_id=7 from the module-7 manifest', async () => {
    const row = await postAttempt(`att_t9_eng7_${suffix}`, 'ENG-M7-EW374', { subject: 'bogus' });
    expect(row).toEqual({ subject: 'english', module_id: 7, grade: 3 });
  });

  it('Tamil FTS0147: stores subject=tamil, module_id=2 (from the module-2 manifest, not the ID string)', async () => {
    const row = await postAttempt(`att_t9_fts_${suffix}`, 'FTS0147', { subject: 'english', moduleId: 1 });
    expect(row).toEqual({ subject: 'tamil', module_id: 2, grade: 3 });
  });

  it('Tamil Q129: stores subject=tamil, module_id=8', async () => {
    const row = await postAttempt(`att_t9_q129_${suffix}`, 'Q129', {});
    expect(row).toEqual({ subject: 'tamil', module_id: 8, grade: 3 });
  });

  it('activity id missing from every manifest is recorded with NULL metadata', async () => {
    const row = await postAttempt(`att_t9_unknown_${suffix}`, 'NOT-IN-ANY-MANIFEST', { subject: 'english' });
    expect(row).toEqual({ subject: null, module_id: null, grade: null });
  });

  it('backfill SQL fills pre-migration rows (NULL metadata) from the manifests, idempotently', async () => {
    const legacyIds = [`att_t9_legacy_fts_${suffix}`, `att_t9_legacy_eng_${suffix}`];
    await sql.query(
      `INSERT INTO attempts (id, student_id, school_id, activity_id, attempt_number, result, completed)
       VALUES ($1, $3, $4, 'FTS0147', 1, 'correct', true), ($2, $3, $4, 'ENG-M5-EW950', 1, 'incorrect', false);`,
      [legacyIds[0], legacyIds[1], studentId, schoolId]
    );

    const backfill = fs.readFileSync(
      path.resolve(process.cwd(), 'server', 'migrations', 'attempts_metadata_backfill.sql'),
      'utf8'
    );
    for (let run = 0; run < 2; run++) {
      for (const statement of splitSqlStatements(backfill)) {
        await sql.query(statement);
      }
    }

    const rows = (await sql.query(
      'SELECT id, subject, module_id, grade FROM attempts WHERE id = ANY($1) ORDER BY id;',
      [legacyIds]
    )) as Array<StoredAttempt & { id: string }>;
    expect(rows).toEqual([
      { id: legacyIds[1], subject: 'english', module_id: 5, grade: 3 },
      { id: legacyIds[0], subject: 'tamil', module_id: 2, grade: 3 },
    ]);
  });
});
