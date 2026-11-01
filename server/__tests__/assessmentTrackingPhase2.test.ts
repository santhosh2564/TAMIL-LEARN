// @vitest-environment node
/**
 * Phase 2 Integration Tests: Persistent Assessment Tracking & Admin Reporting
 * Runs against the isolated test database branch (TEST_DATABASE_URL).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import {
  setDb,
  runMigrations,
  createSchoolInDb,
  getSchoolsWithStatsFromDb,
  createClassWithUniqueCode,
  bulkImportStudentsInDb,
  createOrGetAssessmentSessionInDb,
  recordQuestionAttemptInDb,
  getQuestionAttemptsForSessionFromDb,
  getStudentModuleProgressFromDb,
} from '../db';
import { handleApiRequest } from '../apiHandler';
import { signAdminSession } from '../auth';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';

const testDbUrl = process.env.TEST_DATABASE_URL;
const mainDbUrl = process.env.DATABASE_URL;

const shouldRun = Boolean(testDbUrl && (!mainDbUrl || testDbUrl.trim() !== mainDbUrl.trim()));
const suiteDescribe = shouldRun ? describe : describe.skip;

function mockRequest(options: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}): { req: IncomingMessage & { body?: unknown }; res: ServerResponse; getResult: () => { statusCode: number; data: Record<string, unknown> } } {
  const socket = new Socket();
  const req = new IncomingMessage(socket) as IncomingMessage & { body?: unknown };
  req.method = options.method;
  req.url = options.url;
  req.headers = { host: 'localhost', ...(options.headers || {}) };
  req.body = options.body;

  let statusCode = 200;
  let responseData = '';
  const res = new ServerResponse(req);
  res.end = function (chunk?: string | Buffer) {
    if (chunk) responseData += chunk.toString();
    return this;
  } as typeof res.end;
  Object.defineProperty(res, 'statusCode', {
    get: () => statusCode,
    set: (v) => { statusCode = v; },
  });

  return {
    req,
    res,
    getResult: () => ({
      statusCode,
      data: responseData ? (JSON.parse(responseData) as Record<string, unknown>) : {},
    }),
  };
}

suiteDescribe('Phase 2 Assessment Tracking & Reporting Integration', () => {
  let sql: NeonQueryFunction<false, false>;

  beforeAll(async () => {
    sql = neon(testDbUrl!);
    setDb(sql);
    await runMigrations(sql);
  }, 30000);

  afterAll(() => {
    setDb(null);
  });

  it('Requirement 1 & 2: Configurable academic year & school creation', async () => {
    const schoolCode = `SCH_${Date.now()}`;
    const customAcademicYear = '2026-2027';
    const school = await createSchoolInDb({
      schoolName: 'St. Joseph Academy',
      schoolCode,
      address: '123 Anna Salai, Chennai',
      academicYear: customAcademicYear,
    });

    expect(school.school_name).toBe('St. Joseph Academy');
    expect(school.school_code).toBe(schoolCode);
    expect(school.academic_year).toBe(customAcademicYear);
    expect(school.is_active).toBe(true);

    const allSchools = await getSchoolsWithStatsFromDb();
    const found = allSchools.find((s) => s.id === school.id);
    expect(found).toBeDefined();
    expect(found?.school_name).toBe('St. Joseph Academy');
  }, 30000);

  it('Requirement 3 & 4: Monotonic attempt numbering, idempotency & mathematical progress accuracy', async () => {
    const schoolCode = `SCH_TEST_${Date.now()}`;
    const school = await createSchoolInDb({
      schoolName: 'Chennai Model School',
      schoolCode,
      academicYear: '2026-2027',
    });

    const cls = await createClassWithUniqueCode({
      id: `cls_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 3-A',
      grade: 'Class 3',
    });

    const [student] = await bulkImportStudentsInDb({
      classId: cls.id,
      schoolId: school.id,
      students: [{ name: 'Kavitha', section: 'A', rollNumber: 'R101' }],
    });

    // Create an assessment session
    const session = await createOrGetAssessmentSessionInDb({
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityIds: ['FTS0001', 'FTS0002'],
    });

    expect(session.session_status).toBe('in_progress');
    expect(session.student_id).toBe(student.id);

    // Question 1:
    // Attempt 1: Incorrect
    const key1 = `idem_${Date.now()}_1`;
    const att1 = await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityId: 'FTS0001',
      questionId: 'FTS0001',
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: key1,
    });
    expect(att1.status).toBe('recorded');
    expect(att1.attempt.attempt_number).toBe(1);

    // Duplicate submission with same idempotency key must not duplicate
    const att1Dup = await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityId: 'FTS0001',
      questionId: 'FTS0001',
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: key1,
    });
    expect(att1Dup.status).toBe('duplicate');
    expect(att1Dup.attempt.attempt_number).toBe(1);

    // Attempt 2: Incorrect
    const key2 = `idem_${Date.now()}_2`;
    const att2 = await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityId: 'FTS0001',
      questionId: 'FTS0001',
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: key2,
    });
    expect(att2.status).toBe('recorded');
    expect(att2.attempt.attempt_number).toBe(2);

    // Attempt 3: Correct & Completed
    const key3 = `idem_${Date.now()}_3`;
    const att3 = await recordQuestionAttemptInDb({
      sessionId: session.id,
      studentId: student.id,
      subjectId: 'tamil',
      moduleId: 1,
      activityId: 'FTS0001',
      questionId: 'FTS0001',
      isCorrect: true,
      isCompleted: true,
      idempotencyKey: key3,
    });
    expect(att3.status).toBe('recorded');
    expect(att3.attempt.attempt_number).toBe(3);

    // Verify session attempt list
    const sessionAttempts = await getQuestionAttemptsForSessionFromDb(session.id);
    expect(sessionAttempts.length).toBe(3);
    expect(sessionAttempts.map((a) => a.attempt_number)).toEqual([1, 2, 3]);

    // Verify mathematical accuracy in student_module_progress view
    const progressList = await getStudentModuleProgressFromDb(student.id);
    const mod1Progress = progressList.find((p) => p.module_id === 1 && p.subject_id === 'tamil');
    expect(mod1Progress).toBeDefined();
    expect(mod1Progress?.questions_attempted).toBe(1);
    expect(mod1Progress?.total_attempts).toBe(3);
    expect(mod1Progress?.retried_questions).toBe(1);
    expect(mod1Progress?.total_retry_attempts).toBe(2);
    expect(mod1Progress?.first_attempt_correct).toBe(0); // first attempt was incorrect
    expect(mod1Progress?.finally_correct).toBe(1); // latest attempt was correct
    expect(mod1Progress?.questions_completed).toBe(1);
  }, 30000);

  it('Requirement 4: Scopes English questions when ewId appears across multiple modules', async () => {
    const school = await createSchoolInDb({
      schoolName: 'English Scoping Academy',
      schoolCode: `ENG_SCOPE_${Date.now()}`,
    });
    const cls = await createClassWithUniqueCode({
      id: `cls_eng_${Date.now()}`,
      schoolId: school.id,
      name: 'Class 3-B',
      grade: 'Class 3',
    });
    const [student] = await bulkImportStudentsInDb({
      classId: cls.id,
      schoolId: school.id,
      students: [{ name: 'Arun', section: 'B', rollNumber: 'R202' }],
    });

    const session1 = await createOrGetAssessmentSessionInDb({
      studentId: student.id,
      subjectId: 'english',
      moduleId: 1,
      activityIds: ['ENG-M1-EW021'],
    });

    // EW021 in Module 1: 1 correct attempt
    await recordQuestionAttemptInDb({
      sessionId: session1.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 1,
      activityId: 'ENG-M1-EW021',
      questionId: 'EW021',
      isCorrect: true,
      isCompleted: true,
      idempotencyKey: `m1_ew021_${Date.now()}`,
    });

    const session2 = await createOrGetAssessmentSessionInDb({
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityIds: ['ENG-M2-EW021'],
    });

    // EW021 in Module 2 (Review): 1 wrong attempt, then 1 correct attempt
    await recordQuestionAttemptInDb({
      sessionId: session2.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW021',
      questionId: 'EW021',
      isCorrect: false,
      isCompleted: false,
      idempotencyKey: `m2_ew021_w_${Date.now()}`,
    });

    await recordQuestionAttemptInDb({
      sessionId: session2.id,
      studentId: student.id,
      subjectId: 'english',
      moduleId: 2,
      activityId: 'ENG-M2-EW021',
      questionId: 'EW021',
      isCorrect: true,
      isCompleted: true,
      idempotencyKey: `m2_ew021_c_${Date.now()}`,
    });

    // Verify progress across modules
    const progressList = await getStudentModuleProgressFromDb(student.id);
    const m1 = progressList.find((p) => p.module_id === 1 && p.subject_id === 'english');
    const m2 = progressList.find((p) => p.module_id === 2 && p.subject_id === 'english');

    expect(m1).toBeDefined();
    expect(m1?.questions_attempted).toBe(1);
    expect(m1?.total_attempts).toBe(1);
    expect(m1?.first_attempt_correct).toBe(1);
    expect(m1?.total_retry_attempts).toBe(0);

    expect(m2).toBeDefined();
    expect(m2?.questions_attempted).toBe(1);
    expect(m2?.total_attempts).toBe(2);
    expect(m2?.retried_questions).toBe(1);
    expect(m2?.total_retry_attempts).toBe(1);
    expect(m2?.first_attempt_correct).toBe(0);
    expect(m2?.finally_correct).toBe(1);
  }, 30000);

  it('Requirement 7: Backend API security enforces authentication & authorization', async () => {
    // 1. Unauthenticated request to GET /api/schools must return 401
    const unauthSchools = mockRequest({ method: 'GET', url: '/api/schools' });
    await handleApiRequest(unauthSchools.req, unauthSchools.res);
    expect(unauthSchools.getResult().statusCode).toBe(401);

    // 2. Unauthenticated request to GET /api/admin/reports/overall must return 401
    const unauthReports = mockRequest({ method: 'GET', url: '/api/admin/reports/overall' });
    await handleApiRequest(unauthReports.req, unauthReports.res);
    expect(unauthReports.getResult().statusCode).toBe(401);

    // 3. Super admin session accessing /api/schools and /api/admin/reports/overall must return 200
    const adminToken = await signAdminSession({
      sub: 'super_admin_id',
      username: 'admin',
      role: 'super_admin',
      schoolId: null,
    });

    const authSchools = mockRequest({
      method: 'GET',
      url: '/api/schools',
      headers: { cookie: `sara_admin_session=${adminToken}` },
    });
    await handleApiRequest(authSchools.req, authSchools.res);
    expect(authSchools.getResult().statusCode).toBe(200);
    expect(authSchools.getResult().data.schools).toBeDefined();

    const authReports = mockRequest({
      method: 'GET',
      url: '/api/admin/reports/overall',
      headers: { cookie: `sara_admin_session=${adminToken}` },
    });
    await handleApiRequest(authReports.req, authReports.res);
    expect(authReports.getResult().statusCode).toBe(200);
    expect(authReports.getResult().data.metrics).toBeDefined();
  });
});
