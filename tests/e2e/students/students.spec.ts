import { test, expect } from '@playwright/test';

test.describe('Student Management & Isolation Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before starting each test to ensure isolated state
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('creates students with standard names and Tamil Unicode', async ({ page }) => {
    await page.goto('/students');

    // Create QA Student Alpha
    const input = page.locator('#student-name-input');
    await expect(input).toBeVisible();
    await input.fill('QA Student Alpha');
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // Navigate back to students page to create Student Beta
    await page.goto('/students');
    await page.click('button:has-text("+ New Student")');
    await page.fill('#student-name-input', 'QA Student Beta');
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // Create Tamil Unicode student: QA மாணவன் தமிழ்
    await page.goto('/students');
    await page.click('button:has-text("+ New Student")');
    await page.fill('#student-name-input', 'QA மாணவன் தமிழ்');
    await page.click('button:has-text("Start Learning")');
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // Verify all 3 students appear in the student list
    await page.goto('/students');
    await expect(page.locator('text=QA Student Alpha')).toBeVisible();
    await expect(page.locator('text=QA Student Beta')).toBeVisible();
    await expect(page.locator('text=QA மாணவன் தமிழ்')).toBeVisible();
  });

  test('verifies student switching, strict progress isolation, and deletion', async ({ page }) => {
    // 1. Create Student Alpha
    await page.goto('/students');
    await page.fill('#student-name-input', 'Student Alpha');
    await page.click('button:has-text("Start Learning")');

    // Complete 1 activity for Student Alpha: Q001 (Arrange) or direct activity FTS0001
    await page.goto('/session/3/tamil/play?activityId=FTS0001');
    // FTS0001 is a spelling or choice activity
    // Select option and check
    const optBtns = page.locator('button[lang="ta"]');
    await expect(optBtns.first()).toBeVisible({ timeout: 5000 });
    
    // Find correct answer or first option
    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    await optBtns.first().click();
    await checkBtn.click();

    // Check if correct or wrong
    const success = page.locator('text=சரியான விடை!');
    const isSuccess = await success.isVisible({ timeout: 2000 }).catch(() => false);
    if (!isSuccess) {
      // Retry and click second option
      const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
        await optBtns.nth(1).click();
        await checkBtn.click();
      }
    }

    // Now Student Alpha has completed an activity. Check progress in localStorage
    const alphaProgress = await page.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
      const activeStudent = localStorage.getItem('sa.activeStudentId.v1') || '';
      const map = (snap.students && activeStudent && snap.students[activeStudent]) ? snap.students[activeStudent] : {};
      return { activeStudent, count: Object.keys(map).length };
    });
    expect(alphaProgress.count).toBeGreaterThan(0);

    // 2. Switch to Student Beta
    await page.goto('/students');
    await page.click('button:has-text("+ New Student")');
    await page.fill('#student-name-input', 'Student Beta');
    await page.click('button:has-text("Start Learning")');

    // Verify Student Beta has 0 completed activities in localStorage
    const betaProgressInitial = await page.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
      const activeStudent = localStorage.getItem('sa.activeStudentId.v1') || '';
      const map = (snap.students && activeStudent && snap.students[activeStudent]) ? snap.students[activeStudent] : {};
      return { activeStudent, count: Object.keys(map).length };
    });
    expect(betaProgressInitial.count).toBe(0);

    // 3. Switch back to Student Alpha and verify progress is intact
    await page.goto('/students');
    await page.click('text=Student Alpha');
    await page.goto('/classes/3/subjects/tamil');
    await expect(page.locator('text=கற்பவர்: Student Alpha')).toBeVisible();

    const alphaProgressRetained = await page.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
      const activeStudent = localStorage.getItem('sa.activeStudentId.v1') || '';
      const map = (snap.students && activeStudent && snap.students[activeStudent]) ? snap.students[activeStudent] : {};
      return { activeStudent, count: Object.keys(map).length };
    });
    expect(alphaProgressRetained.count).toBe(alphaProgress.count);

    // 4. Delete Student Beta and verify Student Alpha is unaffected
    // Switch to Student Beta
    await page.goto('/students');
    await page.click('text=Student Beta');

    // Go to Settings and delete Student Beta
    await page.goto('/settings');
    await expect(page.locator('text=Currently learning as Student Beta.')).toBeVisible();
    await page.click('button:has-text("Remove Student Beta from Device")');
    await page.click('button:has-text("Yes, Remove Student Beta")');

    await expect(page.locator("text=Student Beta's profile and data have been removed")).toBeVisible();

    // Verify Student Beta is gone from students list
    await page.goto('/students');
    await expect(page.locator('text=Student Beta')).not.toBeVisible();
    await expect(page.locator('text=Student Alpha')).toBeVisible();

    // Verify Student Alpha's progress is still intact
    await page.click('text=Student Alpha');
    const alphaProgressFinal = await page.evaluate(() => {
      const snap = JSON.parse(localStorage.getItem('sa.learning.progress.v2') || '{}');
      const activeStudent = localStorage.getItem('sa.activeStudentId.v1') || '';
      const map = (snap.students && activeStudent && snap.students[activeStudent]) ? snap.students[activeStudent] : {};
      return { activeStudent, count: Object.keys(map).length };
    });
    expect(alphaProgressFinal.count).toBe(alphaProgress.count);
  });
});
