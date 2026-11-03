// @vitest-environment node
/**
 * Automated tests for Simplified Student Entry and Automatic Identification
 * Tests:
 * 1. Automatic resolution of first-time student (provisions new student in school)
 * 2. Returning student entering normalized name gets existing student profile (no duplicate created)
 * 3. Empty name rejection
 * 4. School scoping isolation (same name in different schools yields different student records)
 * 5. Session creation and attempt recording for auto-identified student
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  setDb,
  runMigrations,
  createSchoolInDb,
  getSchoolById,
  getOrCreateStudentByNameAndSchool,
  findStudentByNameAndSchool,
  createOrGetAssessmentSessionInDb,
  recordQuestionAttemptInDb,
  getQuestionAttemptsForSessionFromDb,
} from '../db';
import { handleApiRequest } from '../apiHandler';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

const shouldRun = Boolean(testDbUrl && (!mainDbUrl || testDbUrl.trim() !== mainDbUrl.trim()));
const suiteDescribe = shouldRun ? describe : describe.skip;

function createMockRequest(
  url: string,
  method = 'GET',
  body?: unknown,
  cookies?: string
): IncomingMessage & { body?: unknown } {
  const socket = new Socket();
  const req = new IncomingMessage(socket) as IncomingMessage & { body?: unknown };
  req.url = url;
  req.method = method;
  req.headers = {
    host: 'localhost',
    'content-type': 'application/json',
    ...(cookies ? { cookie: cookies } : {}),
  };
  req.body = body;
  return req;
}

function createMockResponse(): ServerResponse & { data: string; statusCode: number; headers: Record<string, string> } {
  const socket = new Socket();
  const res = new ServerResponse(new IncomingMessage(socket)) as ServerResponse & {
    data: string;
    statusCode: number;
    headers: Record<string, string>;
  };
  res.data = '';
  res.statusCode = 200;
  res.headers = {};

  res.write = (chunk: unknown) => {
    if (chunk) res.data += chunk.toString();
    return true;
  };
  res.end = (chunk?: unknown) => {
    if (chunk) res.data += chunk.toString();
    return res;
  };
  res.setHeader = (name: string, value: string | number | readonly string[]) => {
    res.headers[name.toLowerCase()] = String(value);
    return res;
  };
  res.getHeader = (name: string) => res.headers[name.toLowerCase()];
  return res;
}

suiteDescribe('Simplified Student Entry & Auto-Resolution (PostgreSQL)', () => {
  let sql: NeonQueryFunction<false, false>;
  const schoolA = `sch_auto_a_${Date.now()}`;
  const schoolB = `sch_auto_b_${Date.now()}`;

  beforeAll(async () => {
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);

    // Create test schools
    await createSchoolInDb({
      id: schoolA,
      name: 'Alpha Primary Academy',
      schoolCode: `APA_${Date.now().toString().slice(-4)}`,
    });

    await createSchoolInDb({
      id: schoolB,
      name: 'Beta Higher Secondary',
      schoolCode: `BHS_${Date.now().toString().slice(-4)}`,
    });
  });

  afterAll(async () => {
    try {
      await sql.query('DELETE FROM schools WHERE id IN ($1, $2);', [schoolA, schoolB]);
    } catch {
      // ignore cleanup errors
    }
  });

  it('1. First-time student entry automatically provisions a student record in Neon', async () => {
    const req = createMockRequest('/api/student/resolve', 'POST', {
      schoolId: schoolA,
      name: '  Ananya  Sundaram  ',
    });
    const res = createMockResponse();

    const handled = await handleApiRequest(req, res);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.data);
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(true);
    expect(body.student.name).toBe('Ananya Sundaram');
    expect(body.student.schoolId).toBe(schoolA);
    expect(body.student.id).toMatch(/^stud_/);

    // Check student cookie set
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toContain('sara_student_session=');
  });

  it('2. Returning student entering the same normalized name resolves to existing profile without creating duplicates', async () => {
    // Repeated entry with different extra spaces and mixed casing
    const req = createMockRequest('/api/student/resolve', 'POST', {
      schoolId: schoolA,
      name: 'ananya   sundaram',
    });
    const res = createMockResponse();

    const handled = await handleApiRequest(req, res);
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.data);
    expect(body.success).toBe(true);
    expect(body.isNew).toBe(false);
    expect(body.student.name).toBe('Ananya Sundaram');
    expect(body.student.schoolId).toBe(schoolA);

    // Verify exactly ONE student row exists in Neon for this name in schoolA
    const rows = (await sql.query(
      `SELECT COUNT(*) as count FROM students WHERE school_id = $1 AND LOWER(TRIM(name)) = LOWER('Ananya Sundaram');`,
      [schoolA]
    )) as { count: string }[];
    expect(Number(rows[0].count)).toBe(1);
  });

  it('3. Rejects empty or whitespace-only student names', async () => {
    const req = createMockRequest('/api/student/resolve', 'POST', {
      schoolId: schoolA,
      name: '   ',
    });
    const res = createMockResponse();

    await handleApiRequest(req, res);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.data);
    expect(body.error).toBe('Invalid request body');
    expect(body.details.name).toContain('Student name is required');
  });

  it('4. Enforces school isolation: identical name in different schools creates distinct isolated students', async () => {
    // School B entry with same name "Ananya Sundaram"
    const req = createMockRequest('/api/student/resolve', 'POST', {
      schoolId: schoolB,
      name: 'Ananya Sundaram',
    });
    const res = createMockResponse();

    await handleApiRequest(req, res);
    expect(res.statusCode).toBe(200);

    const body = JSON.parse(res.data);
    expect(body.isNew).toBe(true);
    expect(body.student.schoolId).toBe(schoolB);

    // Both schools have exactly 1 record each for "Ananya Sundaram"
    const studentA = await findStudentByNameAndSchool('Ananya Sundaram', schoolA);
    const studentB = await findStudentByNameAndSchool('Ananya Sundaram', schoolB);
    expect(studentA).not.toBeNull();
    expect(studentB).not.toBeNull();
    expect(studentA!.id).not.toBe(studentB!.id);
  });

  it('5. Auto-resolved student can start an assessment session and record attempts in Neon', async () => {
    const resolveRes = await getOrCreateStudentByNameAndSchool('Karthik Raja', schoolA);
    const student = resolveRes.student;

    // Create session
    const sessionId = `sess_auto_${Date.now()}`;
    const sess = await createOrGetAssessmentSessionInDb({
      id: sessionId,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityIds: ['tamil-act-1', 'tamil-act-2'],
    });
    expect(sess.id).toBe(sessionId);
    expect(sess.student_id).toBe(student.id);

    // Record question attempt
    const attemptResult = await recordQuestionAttemptInDb({
      id: `qatt_auto_${Date.now()}`,
      sessionId: sess.id,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityId: 'tamil-act-1',
      questionId: 'q-101',
      answerPayload: { choice: 'option_a' },
      isCorrect: true,
      isCompleted: true,
      attemptNumber: 1,
      idempotencyKey: `idem_auto_${Date.now()}`,
    });

    expect(attemptResult.status).toBe('recorded');
    expect(attemptResult.attempt?.student_id).toBe(student.id);

    // Read back from Neon
    const attempts = await getQuestionAttemptsForSessionFromDb(sessionId);
    expect(attempts.length).toBe(1);
    expect(attempts[0].question_id).toBe('q-101');
    expect(attempts[0].is_correct).toBe(true);
  });

  it('6. Concurrent resolution requests for the same student name resolve safely without duplicate student profiles', async () => {
    const studentName = 'முரளிதரன் செல்வகுமார்'; // Muralidharan Selvakumar in Tamil Unicode
    const requests = Array.from({ length: 5 }, () =>
      getOrCreateStudentByNameAndSchool(studentName, schoolA)
    );

    const results = await Promise.all(requests);
    const studentIds = new Set(results.map((r) => r.student.id));

    // Must resolve to the exact same student profile
    expect(studentIds.size).toBe(1);

    // Verify DB count
    const rows = (await sql.query(
      `SELECT COUNT(*) as count FROM students WHERE school_id = $1 AND LOWER(TRIM(name)) = LOWER($2);`,
      [schoolA, studentName]
    )) as { count: string }[];
    expect(Number(rows[0].count)).toBe(1);
  });

  it('7. Tamil Unicode, excess whitespace, and punctuation normalization', async () => {
    const rawEntry1 = '   இளங்கோவன்   கவிதா   ';
    const rawEntry2 = 'இளங்கோவன் கவிதா';

    const r1 = await getOrCreateStudentByNameAndSchool(rawEntry1, schoolA);
    const r2 = await getOrCreateStudentByNameAndSchool(rawEntry2, schoolA);

    expect(r1.student.id).toBe(r2.student.id);
    expect(r1.isNew).toBe(true);
    expect(r2.isNew).toBe(false);
  });
});
