import { test, expect } from '@playwright/test';

test.describe('Accessibility & Responsive Viewport Verification', () => {
  const viewports = [
    { name: 'Desktop', width: 1280, height: 720 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Mobile', width: 390, height: 844 }
  ];

  for (const vp of viewports) {
    test(`renders and tests layout on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/classes/3/subjects/tamil');

      // Check header and categories are visible
      await expect(page.locator('h1', { hasText: 'தமிழ் கற்றல் பகுதி' })).toBeVisible();

      // Check mixed practice card
      await expect(page.locator('text=கலப்பு பயிற்சி')).toBeVisible();

      // Check category cards exist
      const cards = page.locator('div[role="button"], div[class*="rounded-3xl"]');
      expect(await cards.count()).toBeGreaterThan(0);

      // Measure layout metrics
      const dims = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth
      }));

      // Desktop, tablet, and mobile should never have horizontal scroll
      expect(dims.scrollWidth).toBeLessThanOrEqual(dims.clientWidth);
    });
  }

  test('verifies keyboard navigation on activity cards', async ({ page }) => {
    await page.goto('/session/3/tamil/play?activityId=Q010');

    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focusedTag);
  });
});
