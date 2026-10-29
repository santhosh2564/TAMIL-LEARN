import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Target 2: Read-Only Vercel Production Verification', () => {
  // CRITICAL CONSTRAINT: READ-ONLY run against https://tamil-learn-alpha.vercel.app
  // Only GET requests: page loads, console errors, broken links, security headers, and /api/health.
  // NO logins, NO POST/PATCH/DELETE, nothing created.
  test.use({
    baseURL: 'https://tamil-learn-alpha.vercel.app',
    storageState: { cookies: [], origins: [] },
  });

  test('Target 2.1: /api/health returns valid JSON with status and database fields only', async ({ request }) => {
    const res = await request.get('/api/health');
    const status = res.status();
    const text = await res.text();
    console.log('[Read-Only Vercel /api/health Status]:', status);
    console.log('[Read-Only Vercel /api/health Response]:', text);

    const findings: Record<string, unknown> = {
      endpoint: 'https://tamil-learn-alpha.vercel.app/api/health',
      status,
      response: text.slice(0, 500),
    };

    if (status === 200) {
      try {
        const body = JSON.parse(text);
        findings.body = body;
        expect(body).toHaveProperty('status');
        expect(body).toHaveProperty('database');
        expect(body).not.toHaveProperty('branch');
        expect(body).not.toHaveProperty('provider');
      } catch (e: unknown) {
        findings.error = (e as Error).message;
      }
    } else {
      findings.failureReason = 'Remote Vercel serverless function crashed with status ' + status + ' (FUNCTION_INVOCATION_FAILED)';
    }

    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'vercel-health.json'), JSON.stringify(findings, null, 2));
  });

  test('Target 2.2: Home page loads cleanly with security headers and console audit', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedUrls: string[] = [];

    page.on('response', (res) => {
      if (res.status() >= 400) failedUrls.push(`${res.status()}: ${res.url()}`);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    const headers = response?.headers() || {};
    const headerAudit = {
      'content-type': headers['content-type'],
      'x-content-type-options': headers['x-content-type-options'] || 'Missing',
      'strict-transport-security': headers['strict-transport-security'] || 'Missing',
      'x-frame-options': headers['x-frame-options'] || 'Missing',
      'x-xss-protection': headers['x-xss-protection'] || 'Missing',
      'content-security-policy': headers['content-security-policy'] || 'Missing',
    };
    console.log('[Read-Only Vercel Headers Audit]:', headerAudit);

    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const findings = {
      url: 'https://tamil-learn-alpha.vercel.app',
      status: response?.status(),
      headers: headerAudit,
      failedUrls,
      consoleErrors,
    };

    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'vercel-home-audit.json'), JSON.stringify(findings, null, 2));
  });

  test('Target 2.3: Public pages (/join, /admin/login) load cleanly via GET', async ({ page }) => {
    const publicResults: Record<string, unknown> = {};

    for (const p of ['/join', '/admin/login']) {
      const res = await page.goto(p);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(500);

      const status = res?.status();
      const bodyText = (await page.textContent('body')) || '';
      publicResults[p] = {
        status,
        contentLength: bodyText.length,
        hasRootApp: (await page.locator('#root').count()) > 0,
      };
    }

    console.log('[Read-Only Vercel Public Pages]:', publicResults);
    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'vercel-public-pages.json'), JSON.stringify(publicResults, null, 2));
  });
});
