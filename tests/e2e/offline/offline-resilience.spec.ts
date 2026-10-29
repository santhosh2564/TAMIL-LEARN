import { test, expect } from '@playwright/test';
import { seedClass, cleanupClass, loginStudent, testDb, SeededClass } from '../helpers/loginStudent';

test.describe('Offline-First Resilience Verification', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;
  test.beforeAll(async () => {
    seeded = await seedClass({ tag: 'offline', students: ['Offline'] });
  });
  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  test('verifies activity play works when /api becomes unavailable mid-session, and the answer syncs later', async ({ page }) => {
    const studentId = seeded.students[0].id;
    const attemptsFor = async () => {
      const rows = (await testDb().query(
        `SELECT count(*)::int AS n FROM attempts WHERE student_id = $1 AND activity_id = 'Q010';`,
        [studentId]
      )) as { n: number }[];
      return rows[0].n;
    };

    // Students exist only on the server, so log in while online.
    await loginStudent(page, seeded, 'Offline');
    await page.goto('/session/3/tamil/play?activityId=Q010');
    const correctBtn = page.getByRole('button', { name: 'ளி', exact: true });
    await expect(correctBtn).toBeVisible({ timeout: 5000 });

    // Now abort all /api calls to simulate the network failing mid-session.
    await page.route('**/api/**', (route) => route.abort('failed'));

    await correctBtn.click();
    await page.locator('button', { hasText: 'விடையைச் சரிபார்' }).click();

    // Feedback is shown without a crash
    await expect(page.locator('text=சரியான விடை!')).toBeVisible();

    // The attempt is saved locally, and nothing reached the server
    const attemptsStored = await page.evaluate(() => localStorage.getItem('sa.learning.attempts.v1'));
    expect(attemptsStored).toContain('Q010');
    await page.waitForTimeout(2000);
    expect(await attemptsFor()).toBe(0);

    // Network comes back: the queued answer is sent exactly once
    await page.unroute('**/api/**');
    await page.context().setOffline(true);
    await page.context().setOffline(false);
    await expect.poll(attemptsFor, { timeout: 20000 }).toBe(1);
  });
});
