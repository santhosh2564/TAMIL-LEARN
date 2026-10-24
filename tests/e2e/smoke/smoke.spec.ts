import { test, expect } from '@playwright/test';

test.describe('Global Health & Smoke Verification', () => {
  test('verifies Neon API health endpoint returns connected', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.provider).toContain('Neon');
  });

  test('verifies application loads cleanly at root without page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('requestfailed', req => {
      if (!req.url().includes('favicon') && !req.url().includes('vercel')) {
        failedRequests.push(`${req.method()} ${req.url()}: ${req.failure()?.errorText}`);
      }
    });

    await page.goto('/');

    // Check main title & start buttons
    await expect(page.locator('h1', { hasText: 'Learn. Play. Grow.' })).toBeVisible();
    await expect(page.locator('button', { hasText: 'Start Learning' })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
