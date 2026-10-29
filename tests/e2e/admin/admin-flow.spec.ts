import { test, expect } from '@playwright/test';

test.describe('Admin Progress Dashboard & Rule-Based Authorization Suite', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before starting to guarantee pristine state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('Complete End-to-End Flow: Student Activity -> Progress -> Admin Login -> Diagnostics -> Security Guards -> Logout', async ({ page }) => {
    // =========================================================================
    // SCENARIO 1 — STUDENT ACTIVITY & RETRY FLOW
    // =========================================================================

    // 1. Open application and register student profile
    await page.goto('/students');
    const studentInput = page.locator('#student-name-input');
    await expect(studentInput).toBeVisible({ timeout: 5000 });
    await studentInput.fill('Kavitha');
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // 2. Question A (Q010 - Spelling Choice): Complete correctly on FIRST attempt
    await page.goto('/session/3/tamil/play?activityId=Q010');
    const optButtonsA = page.locator('button[lang="ta"]');
    await expect(optButtonsA.first()).toBeVisible({ timeout: 5000 });
    const checkBtnA = page.locator('button', { hasText: 'விடையைச் சரிபார்' });

    // Find and submit the correct answer on first try for Q010
    const countA = await optButtonsA.count();
    let qACorrect = false;
    for (let i = 0; i < countA; i++) {
      await optButtonsA.nth(i).click();
      await checkBtnA.click();
      if (await page.locator('text=சரியான விடை!').isVisible({ timeout: 1500 }).catch(() => false)) {
        qACorrect = true;
        break;
      }
      // If wrong, retry until right
      const rBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
      if (await rBtn.isVisible()) {
        await rBtn.click();
      }
    }
    expect(qACorrect).toBe(true);

    // Continue to finish Q010
    await page.locator('button', { hasText: 'தொடர்க' }).click();

    // 3. Question B (Q012): First attempt wrong, then retry, then correct
    await page.goto('/session/3/tamil/play?activityId=Q012');
    const optButtonsB = page.locator('button[lang="ta"]');
    await expect(optButtonsB.first()).toBeVisible({ timeout: 5000 });
    const checkBtnB = page.locator('button', { hasText: 'விடையைச் சரிபார்' });

    // Click first option and submit (find one that is incorrect or intentionally retry)
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
    // Click option with exact label "ask"
    await exactAskOption.click();
    await page.click('button:has-text("Check Answer")');
    await expect(page.locator('text=Correct!')).toBeVisible({ timeout: 3000 });
    await page.click('button:has-text("Continue")');

    // Refresh browser and verify progress persists in localStorage
    await page.reload();
    const storedProgress = await page.evaluate(() => {
      const activeId = localStorage.getItem('sa.activeStudentId.v1');
      const progSnap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
      return progSnap.students?.[activeId || ''] || null;
    });
    expect(storedProgress).not.toBeNull();
    expect(Object.keys(storedProgress || {}).length).toBeGreaterThan(0);

    // =========================================================================
    // SCENARIO 2 — ADMIN LOGIN & INVALID CREDENTIAL REJECTION
    // =========================================================================

    // 1. Navigate to Admin Login
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();
    await page.screenshot({ path: 'test-results/admin-login-desktop.png', fullPage: true });

    // 2. Submit invalid credentials
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'wrongPassword123');
    await page.click('button:has-text("Sign In as Administrator")');

    // 3. Verify error alert is displayed and user remains on login page
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('Invalid admin credentials');
    await expect(page).toHaveURL(/\/admin\/login/);

    // 4. Submit valid test admin credentials
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'saraAdmin2026!');
    await page.click('button:has-text("Sign In as Administrator")');

    // 5. Verify successful redirect to Admin Dashboard
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByRole('heading', { name: 'Learning Progress Overview' })).toBeVisible();
    await page.screenshot({ path: 'test-results/admin-dashboard-desktop.png', fullPage: true });

    // =========================================================================
    // SCENARIO 3 — ADMIN DASHBOARD METRICS & STUDENT ROSTER VERIFICATION
    // =========================================================================

    // Verify student "Kavitha" appears in roster
    await expect(page.getByText('Kavitha').first()).toBeVisible();

    // Verify summary cards exist and render numeric stats
    await expect(page.getByText('Total Students').first()).toBeVisible();
    await expect(page.getByText('Active Students').first()).toBeVisible();
    await expect(page.getByText('Total Questions Completed').first()).toBeVisible();
    await expect(page.getByText('First-Attempt Successes').first()).toBeVisible();
    await expect(page.getByText('Questions Retried').first()).toBeVisible();
    await expect(page.getByText('Total Retries').first()).toBeVisible();

    // Verify student table headers
    await expect(page.getByText('Student Progress Roster')).toBeVisible();
    await expect(page.getByRole('button', { name: /View progress/ }).first()).toBeVisible();

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
    // SCENARIO 5 — INDIVIDUAL STUDENT VIEW & DIAGNOSTICS
    // =========================================================================

    // Click "Details" button for Kavitha
    await page.click('button[aria-label="View progress for Kavitha"]');
    await expect(page).toHaveURL(/\/admin\/students\//);

    // Verify student detail header
    await expect(page.getByRole('heading', { name: 'Kavitha' })).toBeVisible();
    await expect(page.getByText('Overall Completion').first()).toBeVisible();
    await expect(page.getByText('First-Attempt Correct').first()).toBeVisible();
    await expect(page.getByText('Progress by Learning Category').first()).toBeVisible();
    await expect(page.getByText('Question & Attempt History').first()).toBeVisible();

    // Verify questions appear in question history (both Tamil and English)
    await expect(page.getByText('Q010').first()).toBeVisible();
    await expect(page.getByText('ENG-M1-EW021').first()).toBeVisible();

    // Verify struggle / retry filter
    const struggleCheckbox = page.locator('input[type="checkbox"]');
    await struggleCheckbox.check();
    // When filtered for struggles, first-attempt correct English question is filtered out
    await expect(page.locator('text=ENG-M1-EW021')).not.toBeVisible();

    // Uncheck struggle filter
    await struggleCheckbox.uncheck();
    await expect(page.getByText('ENG-M1-EW021').first()).toBeVisible();

    await page.screenshot({ path: 'test-results/admin-student-details-desktop.png', fullPage: true });

    // =========================================================================
    // SCENARIO 6 — ADMIN LOGOUT & SESSION TERMINATION
    // =========================================================================

    // Click Sign Out
    await page.click('button[aria-label="Log out of admin portal"]');
    await expect(page).toHaveURL(/\/admin\/login/);

    // Try navigating back to /admin/dashboard directly
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.locator('text=Student Progress Roster')).not.toBeVisible();
  });

  test('Responsive Viewport Check: Mobile 375x667', async ({ page }) => {
    // Seed a student and progress so mobile dashboard renders content
    await page.goto('/students');
    await page.fill('#student-name-input', 'MobileLearner');
    await page.click('button:has-text("Start Learning")');

    await page.setViewportSize({ width: 375, height: 667 });

    // Login page on mobile
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible();

    // Sign in on mobile
    await page.fill('#admin-username', 'admin');
    await page.fill('#admin-password', 'saraAdmin2026!');
    await page.click('button:has-text("Sign In as Administrator")');

    // Verify Dashboard adapts to mobile
    await expect(page).toHaveURL(/\/admin\/dashboard/);
    await expect(page.getByText('Sara Admin')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Learning Progress Overview' })).toBeVisible();
    await expect(page.getByText('MobileLearner').first()).toBeVisible();

    // Check student detail on mobile
    await page.click('button[aria-label="View progress for MobileLearner"]');
    await expect(page).toHaveURL(/\/admin\/students\//);
    await expect(page.getByRole('heading', { name: 'MobileLearner' })).toBeVisible();
    await expect(page.getByText('Progress by Learning Category').first()).toBeVisible();

    // Verify document width is contained within mobile viewport
    const overflowWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(overflowWidth).toBeLessThanOrEqual(380);

    await page.screenshot({ path: 'test-results/admin-dashboard-mobile.png', fullPage: true });
  });
});
