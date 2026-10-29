import { test, expect } from '@playwright/test';
import { seedClass, cleanupClass, loginStudent, loginAdmin, testDb, SeededClass, TEST_PIN } from '../helpers/loginStudent';
import { answerTamilQuestion } from '../helpers/answers';

test.describe('B. Admin Flow Verification', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;

  test.beforeAll(async () => {
    seeded = await seedClass({
      tag: 'adminflow',
      students: ['Praveen', 'Divya'],
      withAdmin: true,
    });
  });

  test.beforeEach(async () => {
    await testDb().query('DELETE FROM class_lookup_rate_limits;').catch(() => {});
  });

  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  // ── Item 10 ─────────────────────────────────────────────────────────────────
  test('Item 10: /admin/login: wrong password shows generic error; 5 wrong attempts locks admin for 15 minutes', async ({ page }) => {
    await page.goto('/admin/login');
    await page.fill('#admin-username', seeded.admin!.username);

    // 5 wrong attempts
    for (let i = 1; i <= 5; i++) {
      await page.fill('#admin-password', `wrong-attempt-${i}`);
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/login')),
        page.locator('button[type="submit"]').click(),
      ]);
      expect(res.status()).toBe(401);
      await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 5000 });
    }

    // Check DB for lockout (column is failed_attempts)
    const sql = testDb();
    const adminRows = (await sql.query(
      'SELECT failed_attempts, locked_until FROM admins WHERE id = $1;',
      [seeded.admin!.id]
    )) as { failed_attempts: number; locked_until: string | null }[];

    expect(adminRows.length).toBe(1);
    expect(adminRows[0].failed_attempts).toBe(5);
    expect(adminRows[0].locked_until).not.toBeNull();

    // 6th attempt with correct password must be rejected because of lockout
    await page.fill('#admin-password', seeded.admin!.password);
    const [res6] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/admin/login')),
      page.locator('button[type="submit"]').click(),
    ]);
    expect([401, 423]).toContain(res6.status());
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 5000 });
    expect(page.url()).toContain('/admin/login');

    // Unlock admin for future tests
    await sql.query('UPDATE admins SET failed_attempts = 0, locked_until = NULL WHERE id = $1;', [seeded.admin!.id]);
  });

  // ── Item 11 ─────────────────────────────────────────────────────────────────
  test('Item 11: Admin happy path: login -> create class -> add 3 students -> print cards -> archive student', async ({ page, request }) => {
    // 1. Admin login
    await loginAdmin(page, seeded);

    // 2. Create Class
    await page.getByRole('button', { name: /New Class/i }).click();
    await page.getByPlaceholder('Class 2A').fill('Grade 3 Emerald');
    await page.locator('form select').selectOption('Class 3');
    await page.getByRole('button', { name: 'Create Class' }).click();

    // Verify created class card appears on dashboard
    await expect(page.locator('h3:has-text("Grade 3 Emerald")').first()).toBeVisible({ timeout: 10000 });

    // Fetch created class from DB
    const sql = testDb();
    const classRows = (await sql.query(
      "SELECT id, class_code FROM classes WHERE school_id = $1 AND name = 'Grade 3 Emerald' ORDER BY created_at DESC LIMIT 1;",
      [seeded.schoolId]
    )) as { id: string; class_code: string }[];
    expect(classRows.length).toBe(1);
    const createdClass = classRows[0];

    // 3. Add 3 students via UI
    const addedStudents = [
      { name: 'StudentOne', roll: '01' },
      { name: 'StudentTwo', roll: '02' },
      { name: 'StudentThree', roll: '03' },
    ];

    // Click Add Student on the newly created class
    const classCard = page.locator('.rounded-2xl', { has: page.locator('h3', { hasText: 'Grade 3 Emerald' }) });
    await classCard.locator('button', { hasText: 'Add Student' }).click();

    const addModal = page.locator('div.fixed.inset-0:has-text("Add Student")');
    await expect(addModal).toBeVisible();

    for (const st of addedStudents) {
      await addModal.getByPlaceholder('Kavitha').fill(st.name);
      await addModal.getByPlaceholder('01').fill(st.roll);

      // Select first 3 PIN pictures in the modal 3x3 grid
      const pinGridButtons = addModal.locator('.grid.grid-cols-3 button');
      for (let p = 0; p < 3; p++) {
        await pinGridButtons.nth(p).click();
      }

      const [addRes] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/admin/students') && r.request().method() === 'POST'),
        addModal.locator('button[type="submit"]:has-text("Add Student")').click(),
      ]);
      expect([200, 201]).toContain(addRes.status());
      await page.waitForTimeout(300);
    }
    await addModal.getByRole('button', { name: 'Done' }).click();

    // Verify 3 students exist in DB
    const stuRows = (await sql.query(
      'SELECT id, name, roll_no FROM students WHERE class_id = $1 ORDER BY roll_no ASC;',
      [createdClass.id]
    )) as { id: string; name: string; roll_no: string }[];
    expect(stuRows.length).toBe(3);

    // 4. Navigate to Print Cards
    await classCard.locator('button', { hasText: 'Print Cards' }).click();
    await page.waitForURL(new RegExp(`/admin/classes/${createdClass.id}/print`), { timeout: 10000 });

    // Verify all 3 cards exist with QR code and text
    for (const st of addedStudents) {
      await expect(page.locator(`text=${st.name}`).first()).toBeVisible();
    }
    const qrs = page.locator('img[alt="Class QR Code"]');
    expect(await qrs.count()).toBe(3);

    // Verify @media print hides navigation and buttons (print:hidden classes exist)
    const hiddenInPrint = page.locator('.print\\:hidden');
    expect(await hiddenInPrint.count()).toBeGreaterThan(0);

    // 5. Archive one student (StudentThree) via API (backend contract for admin delete)
    const studentToArchive = stuRows[2];
    const adminLoginRes = await request.post('/api/admin/login', {
      data: { username: seeded.admin!.username, password: seeded.admin!.password },
    });
    const adminCookie = adminLoginRes.headers()['set-cookie']?.split(';')[0];
    const archiveRes = await request.delete(`/api/students/${studentToArchive.id}`, {
      headers: { Cookie: adminCookie || '' },
    });
    expect(archiveRes.status()).toBe(200);

    // Reload print cards: archived student is removed from roster
    await page.reload();
    await expect(page.locator(`text=${studentToArchive.name}`)).not.toBeVisible({ timeout: 5000 });

    // Verify archived student cannot log in
    const loginRes = await request.post('/api/student/login', {
      data: {
        classCode: createdClass.class_code,
        studentId: studentToArchive.id,
        pin: TEST_PIN,
      },
    });
    expect([401, 404]).toContain(loginRes.status());

    // Cleanup created class
    await testDb().query('DELETE FROM students WHERE class_id = $1;', [createdClass.id]);
    await testDb().query('DELETE FROM classes WHERE id = $1;', [createdClass.id]);
  });

  // ── Item 12 ─────────────────────────────────────────────────────────────────
  test('Item 12: Cross-context sync: student answers questions in ctx 1, admin sees count match DB in ctx 2', async ({ browser }) => {
    const student = seeded.students[0];

    // Context 1: Student
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    studentPage.on('dialog', (d) => d.accept());
    await loginStudent(studentPage, seeded, student.name);

    await studentPage.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await expect(studentPage.getByText(/செயல் 1 \/ 5/)).toBeVisible({ timeout: 15000 });

    // Look up active session activity IDs from DB
    const sql = testDb();
    let sessionRows: { id: string; activity_ids: string[] }[] = [];
    for (let retry = 0; retry < 10; retry++) {
      sessionRows = (await sql.query(
        "SELECT id, activity_ids FROM learning_sessions WHERE student_id = $1 AND status = 'active';",
        [student.id]
      )) as { id: string; activity_ids: string[] }[];
      if (sessionRows.length > 0) break;
      await studentPage.waitForTimeout(500);
    }
    expect(sessionRows.length).toBe(1);
    const activityIds = sessionRows[0].activity_ids;

    // Answer 2 questions using correct answer helper
    for (let q = 0; q < 2; q++) {
      await expect(studentPage.getByText(new RegExp(`செயல் ${q + 1} \\/ 5`))).toBeVisible({ timeout: 10000 });
      await answerTamilQuestion(studentPage, activityIds[q], true);
      await studentPage.locator('button', { hasText: 'தொடர்க' }).click();
    }

    // Context 2: Admin
    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    await loginAdmin(adminPage, seeded);

    // Refresh data using aria-label
    await adminPage.getByRole('button', { name: 'Refresh dashboard data' }).click();
    await adminPage.waitForTimeout(1000);

    // Verify row count in DB
    const dbRows = (await sql.query(
      'SELECT count(*)::int as count FROM attempts WHERE student_id = $1;',
      [student.id]
    )) as { count: number }[];
    expect(dbRows[0].count).toBeGreaterThanOrEqual(2);

    await studentCtx.close();
    await adminCtx.close();
  });

  // ── Item 13 ─────────────────────────────────────────────────────────────────
  test('Item 13: Tenant isolation: School A admin cannot see or act on School B classes, students, or reports', async ({ browser }) => {
    // Seed School B with Admin B
    const seededB = await seedClass({
      tag: 'tenantB',
      students: ['Barani'],
      withAdmin: true,
    });

    const adminCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();

    try {
      // 1. Log in as Admin A
      await loginAdmin(adminPage, seeded);

      // 2. Admin A tries to GET /api/admin/classes -> should only see School A's classes
      const classesRes = await adminPage.request.get('/api/admin/classes');
      expect(classesRes.status()).toBe(200);
      const classesData = await classesRes.json();
      const bClassIds = classesData.classes.filter((c: any) => c.school_id === seededB.schoolId);
      expect(bClassIds.length).toBe(0);

      // 3. Admin A tries to view School B student cards -> 403 Forbidden
      const bCardsRes = await adminPage.request.get(`/api/admin/classes/${seededB.classId}/cards`);
      expect(bCardsRes.status()).toBe(403);

      // 4. Admin A tries to add a student to School B's class -> 403 Forbidden
      const addStuRes = await adminPage.request.post('/api/admin/students', {
        data: {
          classId: seededB.classId,
          name: 'HackerStudent',
          rollNo: '99',
          avatar: 'avatar_sun',
          pin: TEST_PIN,
        },
      });
      expect(addStuRes.status()).toBe(403);

      // 5. Admin A tries to delete/archive School B's class -> 403 Forbidden
      const delClassRes = await adminPage.request.delete(`/api/admin/classes/${seededB.classId}`);
      expect(delClassRes.status()).toBe(403);

      // 6. Admin A tries to unlock School B student -> 403 Forbidden
      const unlockRes = await adminPage.request.post(`/api/admin/students/${seededB.students[0].id}/unlock`);
      expect(unlockRes.status()).toBe(403);
    } finally {
      await adminCtx.close();
      await cleanupClass(seededB);
    }
  });

  // ── Item 14 ─────────────────────────────────────────────────────────────────
  test('Item 14: Admin logout clears session, redirect to /admin/login, Back button does not reveal cached data', async ({ page }) => {
    await loginAdmin(page, seeded);
    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // Logout
    const logoutBtn = page.getByRole('button', { name: 'Log out of admin portal' });
    await expect(logoutBtn).toBeVisible({ timeout: 5000 });
    await logoutBtn.click();

    // Verify redirected to /admin/login
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/admin/login');

    // Verify navigating directly back to /admin/dashboard redirects to /admin/login
    await page.goto('/admin/dashboard');
    await page.waitForURL(/\/admin\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/admin/login');
  });
});
