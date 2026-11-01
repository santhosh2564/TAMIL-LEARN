import { test, expect, Page } from '@playwright/test';
import {
  seedClass,
  cleanupClass,
  loginStudent,
  loginAdmin,
  localProgressFor,
  testDb,
  SeededClass,
} from '../helpers/loginStudent';

/** Answers the current single-activity Tamil question correctly, retrying until right. */
async function answerUntilCorrect(page: Page) {
  const opts = page.locator('button[lang="ta"]');
  await expect(opts.first()).toBeVisible({ timeout: 5000 });
  const check = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
  const count = await opts.count();
  for (let i = 0; i < count; i++) {
    await opts.nth(i).click();
    await check.click();
    if (await page.locator('text=சரியான விடை!').isVisible({ timeout: 1500 }).catch(() => false)) return true;
    const retry = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
    if (await retry.isVisible()) await retry.click();
  }
  return false;
}

test.describe('Admin Progress Dashboard & Rule-Based Authorization Suite', () => {
  // Students and the admin log in for real; no student cookie from global setup.
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;
  test.beforeAll(async () => {
    seeded = await seedClass({ tag: 'admin', students: ['Kavitha', 'MobileLearner'], withAdmin: true });
  });
  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  test('Complete End-to-End Flow: Student Activity -> Progress -> Admin Login -> Security Guards -> Logout', async ({ page }) => {
    // =========================================================================
    // SCENARIO 1 — STUDENT ACTIVITY & RETRY FLOW
    // =========================================================================

    // 1. Student logs in through the class link + picture PIN
    page.on('dialog', (d) => d.accept());
    await loginStudent(page, seeded, 'Kavitha');
    const kavithaId = seeded.students[0].id;

    // 2. Question A (Q010 - Spelling Choice): complete correctly
    await page.goto('/session/3/tamil/play?activityId=Q010');
    expect(await answerUntilCorrect(page)).toBe(true);

    // Continue to finish Q010
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // 3. Question B (Q012): First attempt wrong, then retry, then correct
    await page.goto('/session/3/tamil/play?activityId=Q012');
    const optButtonsB = page.locator('button[lang="ta"]');
    await expect(optButtonsB.first()).toBeVisible({ timeout: 5000 });
    const checkBtnB = page.locator('button', { hasText: 'விடையைச் சரிபார்' });

    await optButtonsB.first().click();
    await checkBtnB.click();

    if (await page.locator('text=தவறான விடை').isVisible({ timeout: 2000 }).catch(() => false)) {
      // Intentionally failed first attempt: click retry
      const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
      await expect(retryBtn).toBeVisible();
      await retryBtn.click();

      // Second attempt: find correct answer
      const countB = await optButtonsB.count();
      for (let j = 1; j < countB; j++) {
        await optButtonsB.nth(j).click();
        await checkBtnB.click();
        if (await page.locator('text=சரியான விடை!').isVisible({ timeout: 1500 }).catch(() => false)) {
          break;
        }
        const rBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
        if (await rBtn.isVisible()) {
          await rBtn.click();
        }
      }
      await page.locator('button', { hasText: 'தொடர்க' }).click();
    } else {
      // If first was accidentally correct, test retry on Q013
      await page.locator('button', { hasText: 'தொடர்க' }).click();
      await page.goto('/session/3/tamil/play?activityId=Q013');
      const optButtonsC = page.locator('button[lang="ta"]');
      await optButtonsC.first().click();
      await page.locator('button', { hasText: 'விடையைச் சரிபார்' }).click();
      if (await page.locator('text=தவறான விடை').isVisible({ timeout: 2000 }).catch(() => false)) {
        await page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' }).click();
        await optButtonsC.nth(1).click();
        await page.locator('button', { hasText: 'விடையைச் சரிபார்' }).click();
        await page.locator('button', { hasText: 'தொடர்க' }).click();
      }
    }

    // 4. Question C (English Activity: ENG-M1-EW021): Complete correctly on FIRST attempt
    await page.goto('/session/3/english/play?activityId=ENG-M1-EW021');
    const exactAskOption = page.getByRole('button', { name: 'ask', exact: true });
    await expect(exactAskOption).toBeVisible({ timeout: 5000 });
    await exactAskOption.click();
    await page.click('button:has-text("Check Answer")');
    await expect(page.locator('text=Correct!')).toBeVisible({ timeout: 3000 });
    await page.click('button:has-text("Continue")');

    // Refresh browser and verify progress persists locally for this student
    await page.reload();
    const storedProgress = await localProgressFor(page, kavithaId);
    expect(Object.keys(storedProgress).length).toBeGreaterThan(0);

    // ...and that the server recorded the Tamil and English attempts
    await expect
      .poll(async () => {
        const rows = (await testDb().query(
          `SELECT DISTINCT activity_id FROM attempts WHERE student_id = $1 AND activity_id IN ('Q010', 'ENG-M1-EW021');`,
          [kavithaId]
        )) as { activity_id: string }[];
        return rows.map((r) => r.activity_id).sort();
      }, { timeout: 15000 })
      .toEqual(['ENG-M1-EW021', 'Q010']);

    // The student taps "I'm done" before the teacher uses this browser
    await page.goto('/classes/3/subjects');
    await page.getByRole('button', { name: "முடித்துவிட்டேன் / I'm done" }).click();
    await expect(page).toHaveURL(/\/$/);

    // =========================================================================
    // SCENARIO 2 — ADMIN LOGIN & INVALID CREDENTIAL REJECTION
    // =========================================================================

    // 1. Navigate to Admin Login
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await page.screenshot({ path: 'test-results/admin-login-desktop.png', fullPage: true });

    // 2. Submit invalid credentials
    await page.fill('#admin-username', seeded.admin!.username);
    await page.fill('#admin-password', 'wrongPassword123');
    await page.click('button:has-text("Sign In as Administrator")');

    // 3. Verify error alert is displayed and user remains on login page
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Invalid username or password');
    await expect(page).toHaveURL(/\/admin\/login/);

    // 4. Submit valid credentials (seeded school admin on the TEST database)
    await page.fill('#admin-username', seeded.admin!.username);
    await page.fill('#admin-password', seeded.admin!.password);
    await page.click('button:has-text("Sign In as Administrator")');

    // 5. Verify successful redirect to Admin Dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Learning Progress Overview' })).toBeVisible();
    await page.screenshot({ path: 'test-results/admin-dashboard-desktop.png', fullPage: true });

    // =========================================================================
    // SCENARIO 3 — ADMIN DASHBOARD METRICS
    // (Roster contents are checked in the known-gap test below.)
    // =========================================================================

    await expect(page.getByText('Total Students').first()).toBeVisible();
    await expect(page.getByText('Active Students').first()).toBeVisible();
    await expect(page.getByText('Total Questions Completed').first()).toBeVisible();
    await expect(page.getByText('First-Attempt Successes').first()).toBeVisible();
    await expect(page.getByText('Questions Retried').first()).toBeVisible();
    await expect(page.getByText('Total Retries').first()).toBeVisible();
    await expect(page.getByText('Student Progress Roster')).toBeVisible();

    // =========================================================================
    // SCENARIO 4 — STUDENT SECURITY & ROUTE PROTECTION GUARDS
    // =========================================================================

    // Open a new isolated browser context without admin session (simulating normal student)
    const guestContext = await page.context().browser()!.newContext();
    const guestPage = await guestContext.newPage();

    // Direct navigation to /admin/dashboard while logged out
    await guestPage.goto('/admin/dashboard');

    // Verify redirect to admin login without leaking admin roster
    await expect(guestPage).toHaveURL(/\/admin\/login/);
    await expect(guestPage.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await expect(guestPage.locator('text=Student Progress Roster')).not.toBeVisible();

    // Direct navigation to individual student detail while logged out
    await guestPage.goto('/admin/students/any_id');
    await expect(guestPage).toHaveURL(/\/admin\/login/);
    await expect(guestPage.locator('text=Question & Attempt History')).not.toBeVisible();

    await guestContext.close();

    // =========================================================================
    // SCENARIO 6 — ADMIN LOGOUT & SESSION TERMINATION
    // (Scenario 5, student detail, is in the known-gap test below.)
    // =========================================================================

    await page.locator('button', { hasText: 'Sign Out' }).click();
    await expect(page).toHaveURL(/\/admin\/login/);

    // Try navigating back to /admin/dashboard directly
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('text=Student Progress Roster')).not.toBeVisible();
  });

  test('Responsive Viewport Check: Mobile 375x667', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Login page on mobile
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();

    // Sign in on mobile
    await loginAdmin(page, seeded);

    // Verify Dashboard adapts to mobile
    await expect(page.getByText('Sara Admin')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Learning Progress Overview' })).toBeVisible();

    // Verify document width is contained within mobile viewport
    const overflowWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflowWidth).toBeLessThanOrEqual(380);

    await page.screenshot({ path: 'test-results/admin-dashboard-mobile.png', fullPage: true });
  });

  // KNOWN GAP — expected to fail until the admin dashboard reads server data.
  // AdminProgressService builds the roster and the student detail page from THIS browser's
  // localStorage only. Students who log in through the class link are never stored there,
  // so a teacher never sees them. Playwright reports this test as "expected to fail"; once
  // the dashboard is fixed it passes, Playwright flags that, and test.fail() must be removed.
  test("dashboard roster and student detail show a class-link student's progress", async ({ browser }) => {
    // Student practises on a lab desktop
    const studentContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const studentPage = await studentContext.newPage();
    studentPage.on('dialog', (d) => d.accept());
    await loginStudent(studentPage, seeded, 'MobileLearner');
    await studentPage.goto('/session/3/tamil/play?activityId=Q010');
    expect(await answerUntilCorrect(studentPage)).toBe(true);
    await studentPage.goto('/session/3/english/play?activityId=ENG-M1-EW021');
    await studentPage.getByRole('button', { name: 'ask', exact: true }).click();
    await studentPage.click('button:has-text("Check Answer")');
    await expect(studentPage.locator('text=Correct!')).toBeVisible({ timeout: 3000 });
    await studentContext.close();

    // Teacher opens the dashboard on their own machine
    const adminContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await adminContext.newPage();
    await loginAdmin(page, seeded);

    // Scenario 3: roster lists the student, with a details button
    await expect(page.getByText('MobileLearner').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /Details/ }).first()).toBeVisible();

    // Scenario 5: individual student view & diagnostics
    await page.click('button[aria-label="Details for MobileLearner"]');
    await expect(page).toHaveURL(/\/admin\/students\//);
    await expect(page.getByRole('heading', { name: 'MobileLearner' })).toBeVisible();
    await expect(page.getByText('Overall Completion').first()).toBeVisible();
    await expect(page.getByText('First-Attempt Correct').first()).toBeVisible();
    await expect(page.getByText('Progress by Learning Category').first()).toBeVisible();
    await expect(page.getByText('Question & Attempt History').first()).toBeVisible();
    await expect(page.getByText('Q010').first()).toBeVisible();
    await expect(page.getByText('ENG-M1-EW021').first()).toBeVisible();

    // Struggle filter hides the first-attempt-correct English question, and unchecking restores it
    const struggleCheckbox = page.locator('input[type="checkbox"]');
    await struggleCheckbox.check();
    await expect(page.locator('text=ENG-M1-EW021')).not.toBeVisible();
    await struggleCheckbox.uncheck();
    await expect(page.getByText('ENG-M1-EW021').first()).toBeVisible();
    await adminContext.close();
  });
});
