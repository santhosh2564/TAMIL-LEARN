import { test, expect } from '@playwright/test';
import { setupStudentContext } from './helpers/activity-runner';

test.describe('Tamil Image Mapping & Asset Resolution E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupStudentContext(page);
  });

  // 1. High-profile test cases explicitly required by specification
  test.describe('High-Profile Source-ID Mappings', () => {
    test('FTS0014 (Prefixed filename: Picture_04_FTS0014.jpg)', async ({ page }) => {
      await page.goto('/session/3/tamil/play?activityId=FTS0014');
      const img = page.locator('img[data-testid="activity-asset-image"]');
      await expect(img).toBeVisible({ timeout: 10000 });

      const src = await img.getAttribute('src');
      expect(src).toContain('Picture_04_FTS0014.jpg');

      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    });

    test('FTS0549 (Bare filename: FTS0549.jpg)', async ({ page }) => {
      await page.goto('/session/3/tamil/play?activityId=FTS0549');
      const img = page.locator('img[data-testid="activity-asset-image"]');
      await expect(img).toBeVisible({ timeout: 10000 });

      const src = await img.getAttribute('src');
      expect(src).toContain('FTS0549.jpg');

      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    });

    test('FTS1039 (Suffixed filename: FTS1039_Veliyoor.jpg)', async ({ page }) => {
      await page.goto('/session/3/tamil/play?activityId=FTS1039');
      const img = page.locator('img[data-testid="activity-asset-image"]');
      await expect(img).toBeVisible({ timeout: 10000 });

      const src = await img.getAttribute('src');
      expect(src).toContain('FTS1039_Veliyoor.jpg');

      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    });

    test('Q001 (Earlier Q set suffixed filename: Q001_Muyal.jpg)', async ({ page }) => {
      await page.goto('/session/3/tamil/play?activityId=Q001');
      const img = page.locator('img[data-testid="activity-asset-image"]');
      await expect(img).toBeVisible({ timeout: 10000 });

      const src = await img.getAttribute('src');
      expect(src).toContain('Q001_Muyal.jpg');

      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);
    });
  });

  // 2. Cross-module verification covering representative activities across all 8 modules
  test.describe('Cross-Module Picture Verification (Modules 1 to 8)', () => {
    const moduleTestCases = [
      { module: 1, activityId: 'FTS0003', expectedImage: 'Picture_01_FTS0003.jpg', word: 'அங்காடி' },
      { module: 2, activityId: 'FTS0136', expectedImage: 'FTS0136.jpg', word: 'உட்காரு' },
      { module: 3, activityId: 'FTS0271', expectedImage: 'FTS0271.jpg', word: 'கிண்ணம்' },
      { module: 4, activityId: 'FTS0414', expectedImage: 'FTS0414.jpg', word: 'சிங்கம்' },
      { module: 5, activityId: 'FTS0551', expectedImage: 'FTS0551.jpg', word: 'தேங்காய்' },
      { module: 6, activityId: 'FTS0685', expectedImage: 'FTS0685.jpg', word: 'பந்து' },
      { module: 7, activityId: 'FTS0839', expectedImage: 'FTS0839.jpg', word: 'மரம்' },
      { module: 8, activityId: 'FTS1025', expectedImage: 'FTS1025_Vivasayi.jpg', word: 'விவசாயி' },
    ];

    for (const tc of moduleTestCases) {
      test(`Module ${tc.module}: ${tc.activityId} (${tc.word}) loads ${tc.expectedImage}`, async ({ page }) => {
        await page.goto(`/session/3/tamil/play?activityId=${tc.activityId}`);
        const img = page.locator('img[data-testid="activity-asset-image"]');
        await expect(img).toBeVisible({ timeout: 10000 });

        const src = await img.getAttribute('src');
        expect(src).toContain(tc.expectedImage);

        const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);

        // Ensure no error fallback or broken image icon
        await expect(page.locator('[data-testid="activity-asset-error"]')).not.toBeVisible();
      });
    }
  });

  // 3. Known missing / text exception activities render cleanly without breaking
  test.describe('Known Exceptions Graceful Handling', () => {
    const exceptions = ['FTS0080', 'FTS0903', 'FTS0500', 'FTS0552', 'FTS0553', 'FTS0554'];

    for (const excId of exceptions) {
      test(`Exception ${excId} renders as clean text activity with no broken image`, async ({ page }) => {
        await page.goto(`/session/3/tamil/play?activityId=${excId}`);

        // Prompt container should be visible
        await expect(page.locator('h2, [data-testid="activity-card"]').first()).toBeVisible({ timeout: 10000 });

        // Image should NOT be rendered
        await expect(page.locator('img[data-testid="activity-asset-image"]')).not.toBeVisible();
        await expect(page.locator('[data-testid="activity-asset-error"]')).not.toBeVisible();
      });
    }
  });
});

