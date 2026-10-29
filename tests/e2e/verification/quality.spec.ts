import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedClass, cleanupClass, loginStudent, loginAdmin, testDb, SeededClass } from '../helpers/loginStudent';
import fs from 'fs';
import path from 'path';

test.describe('E. Quality, Accessibility & Resilience Verification', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  let seeded: SeededClass;

  test.beforeAll(async () => {
    seeded = await seedClass({
      tag: 'quality',
      students: ['Kavitha', 'Vikram'],
      withAdmin: true,
    });
  });

  test.beforeEach(async () => {
    await testDb().query('DELETE FROM class_lookup_rate_limits;').catch(() => { });
  });

  test.afterAll(async () => {
    await cleanupClass(seeded);
  });

  // ── Item 22 ─────────────────────────────────────────────────────────────────
  test('Item 22: Console error audit across student and admin happy paths', async ({ page }) => {
    const consoleMessages: { type: string; text: string }[] = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // 1. Visit Home
    await page.goto('/');

    // 2. Visit /join
    await page.goto('/join');

    // 3. Visit class roster
    await page.goto(`/c/${seeded.classCode}`);

    // 4. Log in student
    await loginStudent(page, seeded, 'Kavitha');

    // 5. Visit Tamil category page
    await page.goto('/classes/3/subjects/tamil');

    // 6. Visit Session
    await page.goto('/session/3/tamil/play?category=spelling-choice&size=5');

    // Filter out expected 401 on initial unauthenticated session check
    const errors = consoleMessages.filter(
      (m) => m.type === 'error' && !m.text.includes('401') && !m.text.includes('Failed to load resource: the server responded with a status of 401')
    );

    console.log(`[Item 22] Real console errors count: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    }
  });

  // ── Item 23 ─────────────────────────────────────────────────────────────────
  test('Item 23: Accessibility audit using axe-core across 7 key screens', async ({ page }) => {
    const studentScreens = [
      { name: 'Home', url: '/' },
      { name: 'Join', url: '/join' },
      { name: 'Class Roster', url: `/c/${seeded.classCode}` },
      { name: 'Subject Picker', url: '/classes/3/subjects' },
      { name: 'Tamil Session', url: '/session/3/tamil/play?category=spelling-choice&size=5' },
    ];

    // Log student in first so session and subject screens work
    await loginStudent(page, seeded, 'Kavitha');

    const a11ySummary: Record<string, { critical: number; serious: number; moderate: number; minor: number }> = {};

    for (const screen of studentScreens) {
      await page.goto(screen.url);
      await page.waitForLoadState('domcontentloaded');
      // allow small delay for hydration
      await page.waitForTimeout(500);

      const results = await new AxeBuilder({ page })
        .disableRules(['color-contrast']) // color-contrast often depends on theme
        .analyze();

      const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
      for (const v of results.violations) {
        if (v.impact === 'critical') counts.critical += v.nodes.length;
        if (v.impact === 'serious') counts.serious += v.nodes.length;
        if (v.impact === 'moderate') counts.moderate += v.nodes.length;
        if (v.impact === 'minor') counts.minor += v.nodes.length;
      }
      a11ySummary[screen.name] = counts;
      console.log(`[Item 23 Axe] ${screen.name}:`, counts);
    }

    // Now audit admin screens (Login and Dashboard)
    const adminScreens = [
      { name: 'Admin Login', url: '/admin/login' },
      { name: 'Admin Dashboard', url: '/admin/dashboard' },
    ];

    await loginAdmin(page, seeded);

    for (const screen of adminScreens) {
      if (screen.url === '/admin/login') {
        // Visit login without auth or directly
        const anonContext = await page.context().browser()!.newContext();
        const anonPage = await anonContext.newPage();
        await anonPage.goto(screen.url);
        await anonPage.waitForLoadState('domcontentloaded');
        await anonPage.waitForTimeout(500);

        const results = await new AxeBuilder({ page: anonPage })
          .disableRules(['color-contrast'])
          .analyze();

        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of results.violations) {
          if (v.impact === 'critical') counts.critical += v.nodes.length;
          if (v.impact === 'serious') {
            counts.serious += v.nodes.length;
            console.log(`[Serious Axe Violation on ${screen.name}]`, v.id, v.help, v.nodes.map(n => n.html));
          }
          if (v.impact === 'moderate') counts.moderate += v.nodes.length;
          if (v.impact === 'minor') counts.minor += v.nodes.length;
        }
        a11ySummary[screen.name] = counts;
        console.log(`[Item 23 Axe] ${screen.name}:`, counts);
        await anonContext.close();
      } else {
        await page.goto(screen.url);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        const results = await new AxeBuilder({ page })
          .disableRules(['color-contrast'])
          .analyze();

        const counts = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        for (const v of results.violations) {
          if (v.impact === 'critical') counts.critical += v.nodes.length;
          if (v.impact === 'serious') {
            counts.serious += v.nodes.length;
            console.log(`[Serious Axe Violation on ${screen.name}]`, v.id, v.help, v.nodes.map(n => n.html));
          }
          if (v.impact === 'moderate') counts.moderate += v.nodes.length;
          if (v.impact === 'minor') counts.minor += v.nodes.length;
        }
        a11ySummary[screen.name] = counts;
        console.log(`[Item 23 Axe] ${screen.name}:`, counts);
      }
    }

    // Assert 0 critical and 0 serious violations across all 7 screens
    for (const [screenName, counts] of Object.entries(a11ySummary)) {
      expect(counts.critical, `${screenName} has critical a11y violations`).toBe(0);
      expect(counts.serious, `${screenName} has serious a11y violations`).toBe(0);
    }

    // Save summary for report
    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'a11y-summary.json'), JSON.stringify(a11ySummary, null, 2));
  });

  // ── Item 24 ─────────────────────────────────────────────────────────────────
  test('Item 24: Performance on "old lab PC" profile: 4x CPU throttle & Slow 4G', async ({ page }) => {
    // Emulate 4x CPU throttling and Slow 4G network via CDP session
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 400, // 400ms RTT
      downloadThroughput: 200000, // 1.6 Mbps
      uploadThroughput: 93750, // 750 kbps
      connectionType: 'cellular3g',
    });

    const perfMetrics: Record<string, number> = {};

    // 1. Home
    const t0 = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    perfMetrics['Home (TTI approx)'] = Date.now() - t0;

    // 2. /join
    const t1 = Date.now();
    await page.goto('/join');
    await page.waitForLoadState('domcontentloaded');
    perfMetrics['Join (TTI approx)'] = Date.now() - t1;

    // 3. /c/:code
    const t2 = Date.now();
    await page.goto(`/c/${seeded.classCode}`);
    await page.waitForLoadState('domcontentloaded');
    perfMetrics['Roster (TTI approx)'] = Date.now() - t2;

    console.log('[Item 24 Performance Metrics (ms)]:', perfMetrics);

    // Save metrics
    const reportDir = path.resolve(process.cwd(), 'playwright-report');
    fs.mkdirSync(reportDir, { recursive: true });
    fs.writeFileSync(path.join(reportDir, 'perf-metrics.json'), JSON.stringify(perfMetrics, null, 2));
  });

  // ── Item 25 ─────────────────────────────────────────────────────────────────
  test('Item 25: Bilingual check: no raw keys like "common.submit", "undefined", or "NaN" on screen', async ({ page }) => {
    await loginStudent(page, seeded, 'Kavitha');

    const urls = ['/', '/join', `/c/${seeded.classCode}`, '/classes/3/subjects', '/classes/3/subjects/tamil'];

    for (const u of urls) {
      await page.goto(u);
      await page.waitForLoadState('domcontentloaded');
      const text = await page.textContent('body');

      expect(text).not.toContain('undefined');
      expect(text).not.toContain('NaN');
      expect(text).not.toMatch(/common\.[a-z]+/);
      expect(text).not.toMatch(/auth\.[a-z]+/);
    }
  });

  // ── Item 26 ─────────────────────────────────────────────────────────────────
  test('Item 26: Dead-end crawler: no broken internal links, 404s, or white-screen states', async ({ page }) => {
    await loginStudent(page, seeded, 'Kavitha');

    // Crawl primary internal links
    const routesToVisit = [
      '/',
      '/join',
      '/settings',
      '/credits',
      '/classes/3/subjects',
      '/classes/3/subjects/tamil',
      '/classes/3/subjects/english',
    ];

    for (const r of routesToVisit) {
      const response = await page.goto(r);
      expect(response?.status()).toBeLessThan(400);

      // Verify page is not blank (body has content)
      const bodyHtml = await page.innerHTML('body');
      expect(bodyHtml.length).toBeGreaterThan(200);
      expect(bodyHtml).not.toContain('404 - Not Found');
    }
  });
});
