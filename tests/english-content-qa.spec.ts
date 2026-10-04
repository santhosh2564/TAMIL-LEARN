import { test, expect } from '@playwright/test';

test.describe('Phase D: English Visual Assets & Content Browser QA', () => {
  test('Desktop: Activity interaction, visual assets, fallback, and retry flow', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      // Ignore favicon or non-critical
      if (!req.url().includes('favicon')) {
        failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
      }
    });

    await page.setViewportSize({ width: 1280, height: 720 });

    // 1. Navigate to Module 1 Day 1 Practice Session
    await page.goto('/session/3/english/play?module=1&day=1&size=all');
    await expect(page.getByText(/Activity 1 \/ 24/i)).toBeVisible({ timeout: 15000 });

    // Check no horizontal scroll on desktop
    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // 2. Test Word Entry / Picture Recognition Activity Interaction
    // In Module 1 Day 1, find an input or button
    const wordInput = page.locator('input[aria-label="Word answer input"]');
    const optionButtons = page.locator('button[id^="option-"]');

    if (await wordInput.isVisible()) {
      // Test intentional wrong input -> Try Again -> Correct Input
      await wordInput.fill('incorrectxyz');
      const checkBtn = page.getByRole('button', { name: /Check Answer/i });
      await expect(checkBtn).toBeEnabled();
      await checkBtn.click();

      // Verify Try Again is displayed
      const retryBtn = page.getByRole('button', { name: /Try Again/i });
      await expect(retryBtn).toBeVisible();

      // Click retry
      await retryBtn.click();
      await expect(wordInput).toBeFocused();

      // Verify asset fallback or image is cleanly displayed
      const fallback = page.locator('[data-testid="asset-fallback-missing"]');
      const realImage = page.locator('img[data-testid="activity-asset-image"]');
      const hasVisual = (await fallback.count() > 0) || (await realImage.count() > 0);
      expect(hasVisual).toBe(true);
    } else if (await optionButtons.count() > 0) {
      // Spelling choice: select an option
      const firstOpt = optionButtons.first();
      await firstOpt.click();
      const checkBtn = page.getByRole('button', { name: /Check Answer/i });
      await expect(checkBtn).toBeEnabled();
    }

    // 3. Verify real image rendering (Tamil asset resolution serving image safely)
    await page.goto('/session/3/tamil/play?category=picture-recognition&size=1');
    await expect(page.getByText(/செயல் 1 \/ 1/i)).toBeVisible({ timeout: 15000 });
    const realImg = page.locator('img[data-testid="activity-asset-image"]');
    await expect(realImg).toBeVisible();
    const src = await realImg.getAttribute('src');
    expect(src).toMatch(/^\/assets\/class-3\/tamil\/term-1\/images\//);
    const naturalWidth = await realImg.evaluate((img: HTMLImageElement) => img.naturalWidth);
    expect(naturalWidth).toBeGreaterThan(0);

    // Verify error counts
    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('Mobile Viewport (375x667): Responsive layout, touch buttons, no horizontal scroll', async ({ page }) => {
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      if (!req.url().includes('favicon')) {
        failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
      }
    });

    await page.setViewportSize({ width: 375, height: 667 });

    // 1. English learning area
    await page.goto('/classes/3/subjects/english');
    await expect(page.getByRole('heading', { name: 'English Modules' })).toBeVisible({ timeout: 15000 });

    // Verify no horizontal overflow
    let hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // 2. Module 1 Detail
    await page.goto('/classes/3/subjects/english/modules/1');
    await expect(page.getByRole('heading', { name: /Module 1/i })).toBeVisible({ timeout: 15000 });

    hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // 3. Play session on mobile
    await page.goto('/session/3/english/play?module=1&day=1&size=all');
    await expect(page.getByText(/Activity 1 \/ 24/i)).toBeVisible({ timeout: 15000 });

    hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalScroll).toBe(false);

    // Check button sizing on mobile: buttons must be comfortably tappable
    const checkBtn = page.getByRole('button', { name: /Check Answer/i });
    await expect(checkBtn).toBeVisible();
    const box = await checkBtn.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(40);
      expect(box.width).toBeGreaterThanOrEqual(100);
    }

    expect(pageErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
