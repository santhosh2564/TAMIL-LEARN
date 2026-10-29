import { test, expect } from '@playwright/test';
import {
  getStudentsFromDb,
  getProgressForStudentFromDb,
  getAttemptsForStudentFromDb,
  deleteStudentFromDb
} from '../../../server/db';

test.describe('Neon PostgreSQL End-to-End Browser Integration', () => {
  const neonStudentId = `neon-qa-${Date.now()}`;
  const neonStudentName = 'கவின் (Kavin QA)';

  test.afterAll(async () => {
    // Clean up Neon database
    try {
      await deleteStudentFromDb(neonStudentId);
    } catch {
      // ignore cleanup errors
    }
  });

  test('verifies complete Neon Lakebase Postgres sync lifecycle: create -> activity play -> sync -> delete', async ({ page }) => {
    // 1. Create student
    await page.goto('/students');
    const input = page.locator('#student-name-input');
    if (!await input.isVisible()) {
      await page.click('button:has-text("+ New Student")');
    }
    await page.fill('#student-name-input', neonStudentName);
    await page.click('button:has-text("Start Learning")');

    await expect(page).toHaveURL(/\/classes\/3\/subjects/);

    // Wait a brief moment for async sync to Neon
    await page.waitForTimeout(1500);

    // Query Neon database directly
    const studentsInDb = await getStudentsFromDb();
    const found = studentsInDb.find(s => s.name === neonStudentName);
    expect(found).toBeDefined();
    expect(found?.name).toBe(neonStudentName);
    const activeStudentId = found!.id;

    // Also verify API returns student
    const apiRes = await page.request.get('/api/students');
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const inApi = apiBody.students.find((s: { name: string }) => s.name === neonStudentName);
    expect(inApi).toBeDefined();

    // 2. Play activity Q010 (Correct answer is 'ளி')
    await page.goto('/session/3/tamil/play?activityId=Q010');

    // Solve Q010
    const correctBtn = page.getByRole('button', { name: 'ளி', exact: true });
    await expect(correctBtn).toBeVisible({ timeout: 5000 });
    await correctBtn.click();

    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    await checkBtn.click();
    await expect(page.locator('text=சரியான விடை!')).toBeVisible({ timeout: 5000 });

    // Wait for sync to Neon
    await page.waitForTimeout(2500);

    // Verify in Neon PostgreSQL via server DB query
    const dbProgress = await getProgressForStudentFromDb(activeStudentId);
    expect(dbProgress.length).toBeGreaterThan(0);
    const q010Progress = dbProgress.find(p => p.activity_id === 'Q010');
    expect(q010Progress).toBeDefined();

    const dbAttempts = await getAttemptsForStudentFromDb(activeStudentId);
    expect(dbAttempts.length).toBeGreaterThan(0);
    const q010Attempt = dbAttempts.find(a => a.activity_id === 'Q010');
    expect(q010Attempt).toBeDefined();

    // 3. Delete student in settings and verify cascade
    await page.goto('/settings');

    await page.click('button:has-text("Remove")');
    await page.click('button:has-text("Yes, Remove")');

    await page.waitForTimeout(2500);

    // Verify student is removed from Neon
    const studentsAfter = await getStudentsFromDb();
    const stillExists = studentsAfter.find(s => s.id === activeStudentId);
    expect(stillExists).toBeUndefined();

    // Verify cascade deleted progress in Neon
    const progressAfter = await getProgressForStudentFromDb(activeStudentId);
    expect(progressAfter.length).toBe(0);

    // Verify cascade deleted attempts in Neon
    const attemptsAfter = await getAttemptsForStudentFromDb(activeStudentId);
    expect(attemptsAfter.length).toBe(0);
  });
});
