import { test, expect } from '@playwright/test';

test.describe('Global Health & Smoke Verification', () => {
  test('verifies Neon API health endpoint returns connected', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.database).toBe('connected');
    expect(body.provider).toBeUndefined();
  });

  test('verifies application loads cleanly at root without page errors', async ({ page }) => {
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('pageerror', err => pageErrors.push(err.message));
    // Expected on a fresh load, not errors: the "is an admin logged in?" probe answers 401,
    // and the Vercel analytics script only exists when hosted on Vercel.
    const expectedFailedResources = ['/api/admin/session', '/_vercel/insights/script.js'];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const resource = msg.location().url || '';
        if (expectedFailedResources.some((r) => resource.endsWith(r))) return;
        consoleErrors.push(`${msg.text()} ${resource}`);
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
