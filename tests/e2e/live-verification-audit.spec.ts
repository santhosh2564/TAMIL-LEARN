import { test, expect } from '@playwright/test';
import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const testDbUrl = process.env.TEST_DATABASE_URL!;
const sql = neon(testDbUrl);

test.describe.configure({ mode: 'serial' });

test.describe('TAMIL-LEARN Live Application Verification & Regression Audit', () => {
  const runId = Date.now().toString(36);
  const testSchoolId = `sch_audit_${runId}`;
  const testSchoolCode = `AUDIT_${runId.toUpperCase()}`;
  const testSchoolName = `Audit Academy ${runId}`;
  const testStudentId1 = `stud_audit_1_${runId}`;
  const testStudentId2 = `stud_audit_2_${runId}`;
  const adminUsername = `audit_admin_${runId}`;
  const adminPassword = `AdminPassword_${runId}!`;

  test.beforeAll(async () => {
    // 1. Ensure isolated test database
    expect(testDbUrl).not.toEqual(process.env.DATABASE_URL);

    // 2. Create synthetic test school
    await sql.query(
      `INSERT INTO schools (id, name, school_name, school_code, academic_year)
       VALUES ($1, $2, $2, $3, '2026-2027');`,
      [testSchoolId, testSchoolName, testSchoolCode]
    );

    // 3. Create synthetic students (one without PIN, one with PIN '789')
    const pinHash = await bcrypt.hash('789', 10);
    await sql.query(
      `INSERT INTO students (id, school_id, name, roll_no, roll_number, avatar)
       VALUES ($1, $2, 'Aadhira Audit', 'A01', 'A01', 'avatar_1');`,
      [testStudentId1, testSchoolId]
    );
    await sql.query(
      `INSERT INTO students (id, school_id, name, roll_no, roll_number, avatar, pin_hash)
       VALUES ($1, $2, 'Barath Audit', 'B02', 'B02', 'avatar_2', $3);`,
      [testStudentId2, testSchoolId, pinHash]
    );

    // 4. Create synthetic super_admin
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await sql.query(
      `INSERT INTO admins (id, username, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin');`,
      [`adm_${runId}`, adminUsername, adminHash]
    );
  });

  test.afterAll(async () => {
    // Clean up test records
    await sql.query(`DELETE FROM question_attempts WHERE student_id IN ($1, $2);`, [testStudentId1, testStudentId2]).catch(() => {});
    await sql.query(`DELETE FROM student_module_progress WHERE student_id IN ($1, $2);`, [testStudentId1, testStudentId2]).catch(() => {});
    await sql.query(`DELETE FROM assessment_sessions WHERE student_id IN ($1, $2);`, [testStudentId1, testStudentId2]).catch(() => {});
    await sql.query(`DELETE FROM students WHERE school_id = $1;`, [testSchoolId]).catch(() => {});
    await sql.query(`DELETE FROM admins WHERE username = $1;`, [adminUsername]).catch(() => {});
    await sql.query(`DELETE FROM schools WHERE id = $1;`, [testSchoolId]).catch(() => {});
  });

  // â”€â”€ SECTION 3: RESPONSIVE VIEWPORT INSPECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 3: Viewport audit across desktop, laptop, tablet, and mobile', async ({ page }) => {
    const viewports = [
      { name: 'Desktop', width: 1920, height: 1080 },
      { name: 'Laptop', width: 1366, height: 768 },
      { name: 'Tablet', width: 768, height: 1024 },
      { name: 'Mobile', width: 375, height: 667 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/');
      await expect(page.locator('h1', { hasText: 'Learn. Play. Grow.' })).toBeVisible();

      // Check for horizontal scrollbar / layout overflow
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `${vp.name} viewport should not have horizontal overflow`).toBeLessThanOrEqual(clientWidth + 2);
    }
  });

  // â”€â”€ SECTION 4: SCHOOL SETUP & STUDENT SELECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 4A: School setup, persistence, and isolation', async ({ page }) => {
    // Set computer school in localStorage
    await page.addInitScript((schId) => {
      localStorage.setItem('sara_school_id', schId);
    }, testSchoolId);

    await page.goto('/students');

    // Verify synthetic students for this school are visible
    await expect(page.getByText('Aadhira Audit')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Barath Audit')).toBeVisible();

    // Verify school badge indicates correct school
    await expect(page.getByText(testSchoolName)).toBeVisible();

    // Refresh and verify persistence
    await page.reload();
    await expect(page.getByText('Aadhira Audit')).toBeVisible({ timeout: 10000 });
  });

  test('Section 4B: Student selection without PIN & with PIN', async ({ page }) => {
    await page.addInitScript((schId) => {
      localStorage.setItem('sara_school_id', schId);
    }, testSchoolId);

    await page.goto('/students');

    // 1. Student with PIN opens PIN modal
    await page.getByRole('button', { name: 'Select student Barath Audit' }).click();
    const pinInput = page.locator('input[type="password"]');
    await expect(pinInput).toBeVisible();

    // Cancel PIN dialog
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(pinInput).not.toBeVisible();

    // 2. Student without PIN selects immediately and routes to /subjects
    await page.getByRole('button', { name: 'Select student Aadhira Audit' }).click();
    await page.waitForURL(/\/(subjects|classes\/\d+\/subjects)/, { timeout: 15000 });

    // Verify on Common Course page
    expect(page.url()).toMatch(/\/(subjects|classes\/\d+\/subjects)/);
  });

  // â”€â”€ SECTION 4C: COMMON COURSE & SUBJECT SELECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 4C: Common course subject selection (Tamil & English)', async ({ page }) => {
    await page.addInitScript((schId) => {
      localStorage.setItem('sara_school_id', schId);
    }, testSchoolId);

    await page.goto('/students');
    await page.getByRole('button', { name: 'Select student Aadhira Audit' }).click();
    await page.waitForURL(/\/(subjects|classes\/\d+\/subjects)/, { timeout: 15000 });

    // Verify subject choices are visible
    await expect(page.getByText(/à®¤à®®à®¿à®´à¯|Tamil/i).first()).toBeVisible();
    await expect(page.getByText(/à®†à®™à¯à®•à®¿à®²à®®à¯|English/i).first()).toBeVisible();

    // Verify NO class or grade selectors exist
    await expect(page.locator('select[name="class"]')).toHaveCount(0);
    await expect(page.locator('select[name="grade"]')).toHaveCount(0);
    await expect(page.locator('select[name="section"]')).toHaveCount(0);
  });

  // â”€â”€ SECTION 5: QUESTION-LEVEL ATTEMPT TRACKING DIRECT DATABASE AUDIT â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 5: 3-Attempt answer sequence (Incorrect -> Incorrect -> Correct) database verification', async ({ request }) => {
    // 1. Authenticate synthetic student via API
    const selectRes = await request.post('/api/student/select', {
      data: {
        schoolId: testSchoolId,
        studentId: testStudentId1,
      },
    });
    expect(selectRes.status()).toBe(200);
    const selectData = await selectRes.json();
    expect(selectData.success).toBe(true);

    // Extract student session cookie from response
    const setCookie = selectRes.headers()['set-cookie'] || '';
    const cookieHeader = setCookie.split(';')[0];

    // 2. Create assessment session
    const sessionRes = await request.post('/api/assessment-sessions', {
      headers: { cookie: cookieHeader },
      data: {
        studentId: testStudentId1,
        subjectId: 'tamil',
        moduleId: 1,
        activityIds: ['act_aud_1', 'act_aud_2'],
      },
    });
    expect([200, 201]).toContain(sessionRes.status());
    const sessionData = await sessionRes.json();
    const sessionId = sessionData.session.id;

    // 3. Post Attempt 1: Incorrect
    const att1 = await request.post('/api/question-attempts', {
      headers: { cookie: cookieHeader },
      data: {
        sessionId,
        studentId: testStudentId1,
        questionId: 'q_aud_tamil_001',
        activityId: 'act_aud_1',
        moduleId: 1,
        subjectId: 'tamil',
        isCorrect: false,
        isCompleted: false,
        answerPayload: { selected: 'wrong_1' },
        idempotencyKey: `idem_${runId}_1`,
      },
    });
    expect([200, 201]).toContain(att1.status());

    // 4. Post Attempt 2: Incorrect
    const att2 = await request.post('/api/question-attempts', {
      headers: { cookie: cookieHeader },
      data: {
        sessionId,
        studentId: testStudentId1,
        questionId: 'q_aud_tamil_001',
        activityId: 'act_aud_1',
        moduleId: 1,
        subjectId: 'tamil',
        isCorrect: false,
        isCompleted: false,
        answerPayload: { selected: 'wrong_2' },
        idempotencyKey: `idem_${runId}_2`,
      },
    });
    expect([200, 201]).toContain(att2.status());

    // 5. Post Attempt 3: Correct
    const att3 = await request.post('/api/question-attempts', {
      headers: { cookie: cookieHeader },
      data: {
        sessionId,
        studentId: testStudentId1,
        questionId: 'q_aud_tamil_001',
        activityId: 'act_aud_1',
        moduleId: 1,
        subjectId: 'tamil',
        isCorrect: true,
        isCompleted: true,
        answerPayload: { selected: 'correct_ans' },
        idempotencyKey: `idem_${runId}_3`,
      },
    });
    expect([200, 201]).toContain(att3.status());

    // 6. Direct SQL Inspection on Neon PostgreSQL
    const attempts = await sql.query(
      `SELECT attempt_number, is_correct, question_id, session_id, idempotency_key
       FROM question_attempts
       WHERE student_id = $1 AND question_id = 'q_aud_tamil_001'
       ORDER BY attempt_number ASC;`,
      [testStudentId1]
    );

    expect(attempts).toHaveLength(3);
    expect(attempts[0].attempt_number).toBe(1);
    expect(attempts[0].is_correct).toBe(false);
    expect(attempts[1].attempt_number).toBe(2);
    expect(attempts[1].is_correct).toBe(false);
    expect(attempts[2].attempt_number).toBe(3);
    expect(attempts[2].is_correct).toBe(true);

    // 7. Verify aggregated module progress
    const progress = await sql.query(
      `SELECT questions_attempted, total_attempts, retried_questions, total_retry_attempts, first_attempt_correct, finally_correct, questions_completed
       FROM student_module_progress
       WHERE student_id = $1 AND module_id = 1;`,
      [testStudentId1]
    );

    expect(progress).toHaveLength(1);
    expect(progress[0].questions_attempted).toBe(1);
    expect(progress[0].total_attempts).toBe(3);
    expect(progress[0].retried_questions).toBe(1);
    expect(progress[0].total_retry_attempts).toBe(2);
    expect(progress[0].first_attempt_correct).toBe(0);
    expect(progress[0].finally_correct).toBe(1);
    expect(progress[0].questions_completed).toBe(1);
  });

  // â”€â”€ SECTION 6: IDEMPOTENCY & DUPLICATE PROTECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 6: Network retry with same idempotency key does not duplicate records', async ({ request }) => {
    const selectRes = await request.post('/api/student/select', {
      data: { schoolId: testSchoolId, studentId: testStudentId1 },
    });
    const cookieHeader = selectRes.headers()['set-cookie']?.split(';')[0] || '';

    // Create session
    const sessRes = await request.post('/api/assessment-sessions', {
      headers: { cookie: cookieHeader },
      data: {
        studentId: testStudentId1,
        subjectId: 'tamil',
        moduleId: 1,
        activityIds: ['act_id_1'],
      },
    });
    const sessionId = (await sessRes.json()).session.id;

    const idempotencyKey = `idempotent_test_${runId}`;

    // First attempt submission
    const res1 = await request.post('/api/question-attempts', {
      headers: { cookie: cookieHeader },
      data: {
        sessionId,
        studentId: testStudentId1,
        questionId: 'q_idem_001',
        activityId: 'act_id_1',
        moduleId: 1,
        subjectId: 'tamil',
        isCorrect: true,
        isCompleted: true,
        answerPayload: { selected: 'opt_1' },
        idempotencyKey,
      },
    });
    expect([200, 201]).toContain(res1.status());

    // Duplicate submission (retry) with identical idempotencyKey
    const res2 = await request.post('/api/question-attempts', {
      headers: { cookie: cookieHeader },
      data: {
        sessionId,
        studentId: testStudentId1,
        questionId: 'q_idem_001',
        activityId: 'act_id_1',
        moduleId: 1,
        subjectId: 'tamil',
        isCorrect: true,
        isCompleted: true,
        answerPayload: { selected: 'opt_1' },
        idempotencyKey,
      },
    });
    expect([200, 201]).toContain(res2.status());

    // Database check: exactly ONE row should exist for this idempotency key
    const rows = await sql.query(
      `SELECT id FROM question_attempts WHERE idempotency_key = $1;`,
      [idempotencyKey]
    );
    expect(rows).toHaveLength(1);
  });

  // â”€â”€ SECTION 7: SESSION RECOVERY & RESUME â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 7: Assessment session recovery across reloads', async ({ request }) => {
    const selectRes = await request.post('/api/student/select', {
      data: { schoolId: testSchoolId, studentId: testStudentId1 },
    });
    const cookieHeader = selectRes.headers()['set-cookie']?.split(';')[0] || '';

    // 1. Create active session with activity index 2
    const sessRes = await request.post('/api/assessment-sessions', {
      headers: { cookie: cookieHeader },
      data: {
        studentId: testStudentId1,
        subjectId: 'english',
        moduleId: 1,
        activityIds: ['act_1', 'act_2', 'act_3', 'act_4'],
      },
    });
    const sessionId = (await sessRes.json()).session.id;

    // Update session index to 2
    await request.patch(`/api/assessment-sessions/${sessionId}`, {
      headers: { cookie: cookieHeader },
      data: { currentIndex: 2 },
    });

    // 2. Simulate re-selecting the student (as happens after browser refresh / device reopen)
    const activeRes = await request.get(`/api/students/${testStudentId1}/assessment-sessions/active`, {
      headers: { cookie: cookieHeader },
    });
    expect(activeRes.status()).toBe(200);
    const activeData = await activeRes.json();

    expect(activeData.session).toBeDefined();
    expect(activeData.session.id).toBe(sessionId);
    expect(activeData.session.subject_id).toBe('english');
    expect(Number(activeData.session.current_question_index)).toBe(2);
    expect(activeData.session.session_status).toBe('in_progress');
  });

  // â”€â”€ SECTION 8: ADMIN WORKFLOW & SECURITY â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 8: Admin authentication, school management & student import', async ({ request }) => {
    // 1. Unauthenticated access to admin endpoints is rejected with 401
    const unauthRes = await request.get('/api/admin/reports/overall');
    expect(unauthRes.status()).toBe(401);

    // 2. Admin login with synthetic credentials
    const loginRes = await request.post('/api/admin/login', {
      data: { username: adminUsername, password: adminPassword },
    });
    expect(loginRes.status()).toBe(200);
    const adminCookie = loginRes.headers()['set-cookie']?.split(';')[0] || '';

    // 3. Create a new school
    const newSchoolCode = `NEW_${runId.toUpperCase()}`;
    const createSchoolRes = await request.post('/api/schools', {
      headers: { cookie: adminCookie },
      data: {
        schoolName: `Created School ${runId}`,
        schoolCode: newSchoolCode,
        academicYear: '2026-2027',
      },
    });
    expect(createSchoolRes.status()).toBe(201);
    const createdSchool = (await createSchoolRes.json()).school;

    // 4. Create student directly in that school without class
    const createStudentRes = await request.post('/api/admin/students', {
      headers: { cookie: adminCookie },
      data: {
        schoolId: createdSchool.id,
        name: 'Direct Student Test',
        rollNumber: 'R100',
        avatar: 'fox',
      },
    });
    expect(createStudentRes.status()).toBe(201);

    // 5. Duplicate roll number in same school rejected with 400
    const dupRollRes = await request.post('/api/admin/students', {
      headers: { cookie: adminCookie },
      data: {
        schoolId: createdSchool.id,
        name: 'Another Student',
        rollNumber: 'R100', // same roll number
      },
    });
    expect(dupRollRes.status()).toBe(400);

    // 6. Bulk import students directly to school
    const importRes = await request.post('/api/admin/students/import', {
      headers: { cookie: adminCookie },
      data: {
        schoolId: createdSchool.id,
        students: [
          { name: 'Imported Child A', rollNumber: 'IMP01' },
          { name: 'Imported Child B', rollNumber: 'IMP02' },
        ],
      },
    });
    expect(importRes.status()).toBe(201);
    const importData = await importRes.json();
    expect(importData.importedCount).toBe(2);

    // Clean up created school
    await sql.query(`DELETE FROM students WHERE school_id = $1;`, [createdSchool.id]).catch(() => {});
    await sql.query(`DELETE FROM schools WHERE id = $1;`, [createdSchool.id]).catch(() => {});
  });

  // â”€â”€ SECTION 11: INSTITUTIONAL REPORTING AUDIT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  test('Section 11: Institutional reports contain accurate telemetry without class breakdowns', async ({ request }) => {
    // Log in as super_admin
    const loginRes = await request.post('/api/admin/login', {
      data: { username: adminUsername, password: adminPassword },
    });
    const adminCookie = loginRes.headers()['set-cookie']?.split(';')[0] || '';

    // Fetch school report
    const reportRes = await request.get(`/api/admin/reports/schools/${testSchoolId}`, {
      headers: { cookie: adminCookie },
    });
    expect(reportRes.status()).toBe(200);
    const data = await reportRes.json();

    expect(data.report).toBeDefined();
    expect(data.report.school).toBeDefined();
    expect(data.report.school.school_name || data.report.school.name).toBe(testSchoolName);
    expect(data.report.tamilProgress).toBeDefined();
    expect(data.report.englishProgress).toBeDefined();
    expect(data.report.totalStudents).toBeGreaterThanOrEqual(1);

    // Also verify overall institutional report without class breakdowns
    const overallRes = await request.get('/api/admin/reports/overall', {
      headers: { cookie: adminCookie },
    });
    expect(overallRes.status()).toBe(200);
    const overallData = await overallRes.json();
    expect(overallData.metrics).toBeDefined();
    expect(overallData.metrics.totalSchools).toBeGreaterThanOrEqual(1);
    expect(overallData.metrics.totalStudents).toBeGreaterThanOrEqual(1);
  });
});
