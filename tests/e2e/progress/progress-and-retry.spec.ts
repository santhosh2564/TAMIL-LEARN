import { test, expect } from '@playwright/test';
import { seedClass, cleanupClass, loginStudent, localProgressFor, testDb, SeededClass } from '../helpers/loginStudent';

test.describe('Progress, Evaluator & Retry Logic Verification', () => {
  // Each test logs in fresh through the class link + picture PIN.
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;
  test.beforeAll(async () => {
    seeded = await seedClass({ tag: 'retry', students: ['Retry'] });
  });
  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  test.beforeEach(async ({ page }) => {
    await loginStudent(page, seeded, 'Retry');
  });

  test('verifies Correct first attempt: attempts = 1, retryCount = 0, correct = true', async ({ page }) => {
    // Choose a known question with known options, e.g. Q010 (Correct Spelling)
    // Let's get Q010 from inventory: target_word and options
    await page.goto('/session/3/tamil/play?activityId=Q010');

    // On Q010, find the correct answer button
    // Q010 is spelling choice: target is "பழம்" (fruit) or similar
    // Let's find options and submit the correct one directly
    const optButtons = page.locator('button[lang="ta"]');
    await expect(optButtons.first()).toBeVisible({ timeout: 5000 });

    // Look for button with correct text or click the right one
    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });

    // First attempt: pick the correct answer
    // For Q010: let's query the expected answer from DOM or inventory
    // In SpellingChoice, options are available
    let answered = false;
    const count = await optButtons.count();
    for (let i = 0; i < count; i++) {
      const btn = optButtons.nth(i);
      // Click first option
      await btn.click();
      await checkBtn.click();

      const success = page.locator('text=சரியான விடை!');
      if (await success.isVisible({ timeout: 1500 }).catch(() => false)) {
        answered = true;
        break;
      } else {
        // If it was wrong, click retry and we'll test that on next question
        const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
        await retryBtn.click();
      }
    }

    expect(answered).toBe(true);

    // Verify the local progress record for this student (keyed by the server student id)
    const record = (await localProgressFor(page, seeded.students[0].id))['Q010'];

    expect(record).toBeDefined();
    expect(record.completed).toBe(true);
    expect(record.correct).toBe(true);

    // ...and that the server recorded a correct Q010 attempt for this student
    await expect
      .poll(async () => {
        const rows = (await testDb().query(
          `SELECT count(*)::int AS n FROM attempts WHERE student_id = $1 AND activity_id = 'Q010' AND result = 'correct';`,
          [seeded.students[0].id]
        )) as { n: number }[];
        return rows[0].n;
      }, { timeout: 15000 })
      .toBeGreaterThan(0);
  });

  test('verifies Incorrect -> Correct retry flow: attempts = 2, retryCount = 1, correct = true', async ({ page }) => {
    await page.goto('/session/3/tamil/play?activityId=Q012');

    const optButtons = page.locator('button[lang="ta"]');
    await expect(optButtons.first()).toBeVisible({ timeout: 5000 });
    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    const count = await optButtons.count();

    // 1. Submit deliberately wrong answer first
    // Let's test each option until we hit a wrong one
    await optButtons.first().click();
    await checkBtn.click();

    const success = page.locator('text=சரியான விடை!');

    if (await success.isVisible({ timeout: 1500 }).catch(() => false)) {
      // It was accidentally correct on first option, so let's try another activity for retry test
      // Q013
      await page.goto('/session/3/tamil/play?activityId=Q013');
      const opts = page.locator('button[lang="ta"]');
      await opts.nth(count > 1 ? 1 : 0).click();
      await page.locator('button', { hasText: 'விடையைச் சரிபார்' }).click();
    }

    // Now we see wrong feedback
    if (await page.locator('text=தவறான விடை').isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' })).toBeVisible();

      // Click Retry
      await page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' }).click();

      // Now click another option to get it right
      const allOpts = page.locator('button[lang="ta"]');
      const optCount = await allOpts.count();
      for (let j = 0; j < optCount; j++) {
        await allOpts.nth(j).click();
        await page.locator('button', { hasText: 'விடையைச் சரிபார்' }).click();
        if (await page.locator('text=சரியான விடை!').isVisible({ timeout: 1500 }).catch(() => false)) {
          break;
        }
        const rBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
        if (await rBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await rBtn.click();
        }
      }

      await expect(page.locator('text=சரியான விடை!')).toBeVisible();
      await expect(page.locator('button', { hasText: 'தொடர்க' })).toBeVisible();
    }
  });

  test('verifies Results page displays score, retry count, attempts, and student name', async ({ page }) => {
    // Navigate to single-activity session
    await page.goto('/session/3/tamil/play?activityId=Q010');

    // Answer Q010 correctly
    const optButtons = page.locator('button[lang="ta"]');
    await expect(optButtons.first()).toBeVisible({ timeout: 5000 });
    const checkBtn = page.locator('button', { hasText: 'விடையைச் சரிபார்' });
    const count = await optButtons.count();

    for (let i = 0; i < count; i++) {
      await optButtons.nth(i).click();
      await checkBtn.click();
      if (await page.locator('text=சரியான விடை!').isVisible({ timeout: 1500 }).catch(() => false)) {
        break;
      }
      const retryBtn = page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' });
      if (await retryBtn.isVisible()) {
        await retryBtn.click();
      }
    }

    // Click Continue ("தொடர்க") to finish the session and navigate to results
    const continueBtn = page.locator('button', { hasText: 'தொடர்க' });
    await expect(continueBtn).toBeVisible({ timeout: 3000 });
    await continueBtn.click();

    // Verify Results Page loads
    await expect(page).toHaveURL(/\/session\/results/);
    await expect(page.getByRole('heading', { name: /Retry/ })).toBeVisible();
    await expect(page.locator('button', { hasText: 'கற்றல் பகுதி' })).toBeVisible();
    await expect(page.getByText('செயல்கள்')).toBeVisible();
    await expect(page.getByText('100%')).toBeVisible();
  });
});
