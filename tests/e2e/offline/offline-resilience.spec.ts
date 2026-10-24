import { test, expect } from '@playwright/test';

test.describe('Offline-First Resilience Verification', () => {
  test('verifies student creation and activity play work offline when /api is unavailable', async ({ page }) => {
    // Abort all /api calls to simulate offline / network failure
    await page.route('**/api/**', route => route.abort('failed'));

    // Navigate to student creation
    await page.goto('/students');
    const input = page.locator('#student-name-input');
    if (!await input.isVisible()) {
      await page.click('button:has-text("+ New Student")');
    }
    await page.fill('#student-name-input', 'Offline Student');
    await page.click('button:has-text("Start Learning")');

    // UI should navigate without crashing
    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // Verify student is stored locally in localStorage
    const storedStudent = await page.evaluate(() => {
      return localStorage.getItem('sa.students.v1');
    });
    expect(storedStudent).toContain('Offline Student');

    // Navigate to activity and solve it offline
    await page.goto('/session/3/tamil/play?activityId=Q010');
    const correctBtn = page.getByRole('button', { name: 'ளி', exact: true });
    await expect(correctBtn).toBeVisible({ timeout: 5000 });
    await correctBtn.click();

    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    await checkBtn.click();

    // Verify feedback is shown without crash
    await expect(page.locator('text=சரியான விடை!')).toBeVisible();

    // Verify local attempt is saved
    const attemptsStored = await page.evaluate(() => {
      return localStorage.getItem('sa.learning.attempts.v1');
    });
    expect(attemptsStored).toContain('Q010');
  });
});
