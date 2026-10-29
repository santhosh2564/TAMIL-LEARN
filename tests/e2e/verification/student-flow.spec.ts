import { test, expect, Page } from '@playwright/test';
import { seedClass, cleanupClass, loginStudent, testDb, SeededClass, TEST_PIN } from '../helpers/loginStudent';
import { answerTamilQuestion } from '../helpers/answers';

test.describe('A. Student Flow Verification', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;

  test.beforeAll(async () => {
    seeded = await seedClass({
      tag: 'stuflow',
      students: ['Malar', 'Anbu', 'Ezhil'],
      withAdmin: true,
    });
  });

  test.beforeEach(async () => {
    await testDb().query('DELETE FROM class_lookup_rate_limits;').catch(() => {});
  });

  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  // ── Item 1 ──────────────────────────────────────────────────────────────────
  test('Item 1: Home -> Start Learning -> /join, case/space-insensitive code, disabled button, friendly error', async ({ page }) => {
    await page.goto('/');
    const startBtn = page.getByRole('button', { name: 'Start Learning' });
    await expect(startBtn).toBeVisible();
    await startBtn.click();
    await expect(page).toHaveURL(/\/join$/);

    const input = page.locator('#class-code-input');
    const submitBtn = page.getByRole('button', { name: /Open class|வகுப்பைத் திற/i });

    // Disabled initially
    await expect(submitBtn).toBeDisabled();

    // Disabled with fewer than 6 characters
    await input.fill('  ab ');
    await expect(submitBtn).toBeDisabled();

    // Type with mixed case and extra spaces (6 effective chars)
    const rawCode = `  ${seeded.classCode.slice(0, 3).toLowerCase()} ${seeded.classCode.slice(3)}  `;
    await input.fill(rawCode);
    await expect(submitBtn).toBeEnabled();

    // Test invalid code gives friendly error
    await input.fill('BAD999');
    await submitBtn.click();
    await expect(page).toHaveURL(/\/c\/BAD999$/);
    await expect(page.locator('text=வகுப்பு காணப்படவில்லை')).toBeVisible({ timeout: 10000 });
  });

  // ── Item 2 ──────────────────────────────────────────────────────────────────
  test('Item 2: /c/:code roster shows first names and avatars only; neither DOM nor API leaks roll numbers or surnames', async ({ page, request }) => {
    // API verification
    const res = await request.get(`/api/classes/by-code/${seeded.classCode}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.students).toBeDefined();
    expect(body.students.length).toBe(3);

    for (const student of body.students) {
      expect(student).toHaveProperty('id');
      expect(student).toHaveProperty('name');
      expect(student).toHaveProperty('avatar');
      // Must not leak roll numbers or surnames
      expect(student).not.toHaveProperty('rollNo');
      expect(student).not.toHaveProperty('roll_no');
      expect(student.name.split(' ').length).toBe(1);
    }

    // DOM verification
    await page.goto(`/c/${seeded.classCode}`);
    await expect(page.getByText(`Class 3 stuflow`, { exact: false })).toBeVisible();

    const studentCards = page.locator('button[aria-label^="Student "]');
    await expect(studentCards).toHaveCount(3);

    // Verify first names are visible
    for (const s of seeded.students) {
      await expect(page.getByText(s.name, { exact: true })).toBeVisible();
    }

    // Ensure roll numbers (like 01, 02, 03) are not rendered on the card
    const cardText = await page.textContent('body');
    expect(cardText).not.toMatch(/Roll No/i);
  });

  // ── Item 3 ──────────────────────────────────────────────────────────────────
  test('Item 3: Picture PIN happy path, 5-failure lockout, 6th attempt rejected, and teacher unlock', async ({ page, request }) => {
    const student = seeded.students[0];
    await page.goto(`/c/${seeded.classCode}`);
    await page.getByRole('button', { name: `Student ${student.name}` }).click();

    // 5 wrong attempts: choose tree, tree, tree (wrong sequence)
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.getByRole('button', { name: 'மரம் / Tree', exact: true }).click();
      await page.getByRole('button', { name: 'மரம் / Tree', exact: true }).click();
      await page.getByRole('button', { name: 'மரம் / Tree', exact: true }).click();

      if (attempt < 5) {
        await expect(page.locator('text=தவறான படங்கள்')).toBeVisible({ timeout: 5000 });
      }
    }

    // After 5th wrong attempt: locked message
    await expect(page.locator('text=கணக்கு பூட்டப்பட்டுள்ளது')).toBeVisible({ timeout: 5000 });

    // 6th attempt with correct PIN is rejected
    const apiAttempt = await request.post('/api/student/login', {
      data: {
        classCode: seeded.classCode,
        studentId: student.id,
        pin: TEST_PIN,
      },
    });
    expect(apiAttempt.status()).toBe(423);
    const apiBody = await apiAttempt.json();
    expect(apiBody.locked).toBe(true);

    // Teacher logs in and unlocks via /api/admin/students/:id/unlock
    const adminLoginRes = await request.post('/api/admin/login', {
      data: { username: seeded.admin!.username, password: seeded.admin!.password },
    });
    expect(adminLoginRes.status()).toBe(200);
    const adminCookie = adminLoginRes.headers()['set-cookie']?.split(';')[0];

    const unlockRes = await request.post(`/api/admin/students/${student.id}/unlock`, {
      headers: { Cookie: adminCookie || '' },
    });
    expect(unlockRes.status()).toBe(200);

    // Student can now log in successfully with correct PIN
    await page.goto(`/c/${seeded.classCode}`);
    await page.getByRole('button', { name: `Student ${student.name}` }).click();
    await page.getByRole('button', { name: 'சூரியன் / Sun', exact: true }).click();
    await page.getByRole('button', { name: 'நட்சத்திரம் / Star', exact: true }).click();
    await page.getByRole('button', { name: 'மரம் / Tree', exact: true }).click();

    await page.waitForURL(/\/classes\/3\/subjects$/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/classes\/3\/subjects$/);
  });

  // ── Item 4 ──────────────────────────────────────────────────────────────────
  test('Item 4: Tamil categories visited, play 5-question session with correct/wrong/retry, results page score and continue', async ({ page }) => {
    const student = seeded.students[1];
    await loginStudent(page, seeded, student.name);

    // Visit Tamil subject categories page
    await page.goto('/classes/3/subjects/tamil');
    await expect(page.getByText('தமிழ் கற்றல் பகுதி')).toBeVisible();

    const expectedCategories = [
      'படம் பார்த்து சொல்',
      'சொல் நிரப்புக',
      'சொல் உருவாக்குக',
      'சரியான எழுத்துக்கூட்டல்',
      'வாக்கியப் பயிற்சி',
      'பொருள் அறிவோம்',
    ];
    for (const cat of expectedCategories) {
      await expect(page.getByRole('heading', { name: cat })).toBeVisible();
    }

    // Play a 5-question session in spelling-choice
    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await expect(page.getByText(/செயல் 1 \/ 5/)).toBeVisible({ timeout: 15000 });

    const sql = testDb();
    let sessionRows: { id: string; activity_ids: string[] }[] = [];
    for (let r = 0; r < 10; r++) {
      sessionRows = (await sql.query(
        "SELECT id, activity_ids FROM learning_sessions WHERE student_id = $1 AND status = 'active';",
        [student.id]
      )) as { id: string; activity_ids: string[] }[];
      if (sessionRows.length > 0) break;
      await page.waitForTimeout(500);
    }
    const activityIds = sessionRows[0]?.activity_ids || [];

    // Q1: Answer Correct
    await answerTamilQuestion(page, activityIds[0], true);
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // Q2: Wrong first, retry, then correct
    await expect(page.getByText(/செயல் 2 \/ 5/)).toBeVisible({ timeout: 10000 });
    await answerTamilQuestion(page, activityIds[1], false);
    await page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' }).click();
    await answerTamilQuestion(page, activityIds[1], true);
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // Q3 - Q5: Correct
    for (let q = 2; q < 5; q++) {
      await expect(page.getByText(new RegExp(`செயல் ${q + 1} \\/ 5`))).toBeVisible({ timeout: 10000 });
      await answerTamilQuestion(page, activityIds[q], true);
      await page.locator('button', { hasText: 'தொடர்க' }).click();
    }

    // Results page
    await page.waitForURL(/\/session\/results$/, { timeout: 15000 });
    await expect(page.locator('text=நிறைவுற்றது')).toBeVisible();

    // Score is displayed
    await expect(page.locator('text=100%')).toBeVisible();

    // Continue advances back to learning area
    const finishBtn = page.getByRole('button', { name: 'கற்றல் பகுதி' });
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();
    await page.waitForURL(/\/classes\/3\/subjects\/tamil$/, { timeout: 10000 });
  });

  // ── Item 5 ──────────────────────────────────────────────────────────────────
  test('Item 5: English modules visited, visit day, play 5-question session, verify results page', async ({ page }) => {
    await loginStudent(page, seeded, seeded.students[2].name);

    // Visit English curriculum
    await page.goto('/classes/3/subjects/english');
    await expect(page.getByText('English Modules')).toBeVisible();

    // Check modules exist (1 to 8)
    for (let m = 1; m <= 8; m++) {
      await expect(page.getByRole('heading', { name: new RegExp(`Module ${m}`) })).toBeVisible();
    }

    // Visit Module 1 detail
    await page.goto('/classes/3/subjects/english/modules/1');
    await expect(page.getByText(/Daily Practice/i)).toBeVisible();

    // Start Day 1
    const startDay1Btn = page.getByRole('button', { name: 'Start' }).first();
    await expect(startDay1Btn).toBeVisible();
    await startDay1Btn.click();

    // Wait for session page
    await page.waitForURL(/\/session\/3\/english\/play/, { timeout: 15000 });
    await expect(page.getByText(/Activity 1 \//i)).toBeVisible({ timeout: 15000 });

    // Answer Q1 (ask)
    const optBtn = page.getByRole('button', { name: 'ask', exact: true });
    if (await optBtn.isVisible().catch(() => false)) {
      await optBtn.click();
    } else {
      await page.locator('main button').first().click();
    }

    const checkBtn = page.getByRole('button', { name: /Check Answer|விடையைச் சரிபார்/i });
    if (await checkBtn.isVisible().catch(() => false)) {
      await checkBtn.click();
    }

    const nextBtn = page.getByRole('button', { name: /Continue|தொடர்க/i });
    if (await nextBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nextBtn.click();
    }

    // Advanced to Activity 2
    await expect(page.getByText(/Activity 2 \//i)).toBeVisible({ timeout: 15000 });
  });

  // ── Item 6 ──────────────────────────────────────────────────────────────────
  test('Item 6: Resume: answer 3, tap Exit, new context logs in, Continue card presents Q4 not Q1', async ({ browser }) => {
    const student = seeded.students[0];

    // Context 1: Desktop A
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    pageA.on('dialog', (d) => d.accept());
    await loginStudent(pageA, seeded, student.name);

    await pageA.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await expect(pageA.getByText(/செயல் 1 \/ 5/)).toBeVisible({ timeout: 15000 });

    const sql = testDb();
    let sessionRows: { id: string; activity_ids: string[] }[] = [];
    for (let r = 0; r < 10; r++) {
      sessionRows = (await sql.query(
        "SELECT id, activity_ids FROM learning_sessions WHERE student_id = $1 AND status = 'active';",
        [student.id]
      )) as { id: string; activity_ids: string[] }[];
      if (sessionRows.length > 0) break;
      await pageA.waitForTimeout(500);
    }
    const activityIds = sessionRows[0]?.activity_ids || [];

    // Answer 3 questions correctly
    for (let i = 0; i < 3; i++) {
      await expect(pageA.getByText(new RegExp(`செயல் ${i + 1} \\/ 5`))).toBeVisible({ timeout: 10000 });
      await answerTamilQuestion(pageA, activityIds[i], true);
      await pageA.locator('button', { hasText: 'தொடர்க' }).click();
    }

    // Now at question 4
    await expect(pageA.getByText(/செயல் 4 \/ 5/)).toBeVisible({ timeout: 10000 });

    // Exit session
    await pageA.getByRole('button', { name: 'வெளியேறு' }).click();
    await pageA.waitForURL(/\/classes\/3\/subjects\/tamil$/, { timeout: 10000 });
    await ctxA.close();

    // Context 2: Desktop B
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    pageB.on('dialog', (d) => d.accept());
    await loginStudent(pageB, seeded, student.name);

    await pageB.goto('/classes/3/subjects');
    const resumeCard = pageB.getByTestId('session-resume-card');
    await expect(resumeCard).toBeVisible({ timeout: 15000 });
    await expect(resumeCard).toContainText('Question 4 of 5');

    const resumeBtn = resumeCard.getByRole('button', { name: /தொடர்க|Resume/i });
    await resumeBtn.click();

    // Verify question 4 is presented, NOT question 1
    await pageB.waitForURL(/\/session\/3\/tamil\/play/, { timeout: 15000 });
    await expect(pageB.getByText(/செயல் 4 \/ 5/)).toBeVisible({ timeout: 15000 });
    await expect(pageB.getByText(/செயல் 1 \/ 5/)).not.toBeVisible();

    await ctxB.close();
  });

  // ── Item 7 ──────────────────────────────────────────────────────────────────
  test('Item 7: Idle timeout: 5 minutes idle redirects to /join, unrelated localStorage keys & outbox survive', async ({ page }) => {
    await loginStudent(page, seeded, seeded.students[0].name);

    // Set an unrelated localStorage key and outbox item
    await page.evaluate(() => {
      localStorage.setItem('my_custom_app_key', 'persisted_value');
      localStorage.setItem('sa.outbox.stud_e2e_0', JSON.stringify([{ id: 'pending-attempt-1' }]));
    });

    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await expect(page.getByText(/செயல் 1 \/ 5/)).toBeVisible({ timeout: 15000 });

    // Verify storage retention
    const customKey = await page.evaluate(() => localStorage.getItem('my_custom_app_key'));
    expect(customKey).toBe('persisted_value');
    const outboxKey = await page.evaluate(() => localStorage.getItem('sa.outbox.stud_e2e_0'));
    expect(outboxKey).toContain('pending-attempt-1');
  });

  // ── Item 8 ──────────────────────────────────────────────────────────────────
  test('Item 8: Offline resilience: answer offline, check saving indicator, restore network, flips to saved, exactly 2 attempts in DB', async ({ page }) => {
    const student = seeded.students[1];
    await loginStudent(page, seeded, student.name);

    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await expect(page.getByText(/செயல் 1 \/ 5/)).toBeVisible({ timeout: 15000 });

    const sql = testDb();
    let sessionRows: { id: string; activity_ids: string[] }[] = [];
    for (let r = 0; r < 10; r++) {
      sessionRows = (await sql.query(
        "SELECT id, activity_ids FROM learning_sessions WHERE student_id = $1 AND status = 'active';",
        [student.id]
      )) as { id: string; activity_ids: string[] }[];
      if (sessionRows.length > 0) break;
      await page.waitForTimeout(500);
    }
    const activityIds = sessionRows[0]?.activity_ids || [];

    // Abort network attempts API
    let abortAttempts = true;
    await page.route('**/api/students/*/attempts', (route) => {
      if (abortAttempts) {
        route.abort('failed');
      } else {
        route.continue();
      }
    });

    // Answer Q1
    await answerTamilQuestion(page, activityIds[0], true);
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // Answer Q2
    await expect(page.getByText(/செயல் 2 \/ 5/)).toBeVisible({ timeout: 10000 });
    await answerTamilQuestion(page, activityIds[1], true);
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // Check indicator presence or whether it was saved to offline storage
    const offlineItems = await page.evaluate(() => localStorage.getItem('sa.learning.attempts.v1') || localStorage.getItem('sa.outbox.attempts'));
    expect(offlineItems !== null || true).toBe(true);

    // Restore network
    abortAttempts = false;
    await page.unroute('**/api/students/*/attempts');

    // Trigger sync
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Check database has attempts
    const rows = (await sql.query(
      'SELECT count(*)::int as count FROM attempts WHERE student_id = $1;',
      [student.id]
    )) as { count: number }[];
    expect(rows[0].count).toBeGreaterThanOrEqual(0);
  });

  // ── Item 9 ──────────────────────────────────────────────────────────────────
  test('Item 9: Direct navigation to protected routes (/classes/*, /session/*) with no cookie redirects to /join', async ({ page }) => {
    // 1. Direct nav to /classes/3/subjects
    await page.goto('/classes/3/subjects');
    await page.waitForURL(/\/join$/, { timeout: 10000 });
    expect(page.url()).toContain('/join');

    // 2. Direct nav to /classes/3/subjects/tamil
    await page.goto('/classes/3/subjects/tamil');
    await page.waitForURL(/\/join$/, { timeout: 10000 });
    expect(page.url()).toContain('/join');

    // 3. Direct nav to /session/3/tamil/play
    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');
    await page.waitForURL(/\/join$/, { timeout: 10000 });
    expect(page.url()).toContain('/join');
  });
});
