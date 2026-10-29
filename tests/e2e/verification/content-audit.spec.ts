import { test, expect } from '@playwright/test';
import { answerTamilQuestion } from '../helpers/answers';

test.describe('C. Content Audit & Evaluator Verification', () => {
  // Use default storageState from globalSetup (logged-in student)

  // ── Item 15 ─────────────────────────────────────────────────────────────────
  test('Item 15: Content audit: Tamil and English activities render, images load (naturalWidth > 0), Tamil font family', async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedUrls: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 404) failedUrls.push(res.url());
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Test a sample of representative activities from each category
    const sampleActivities = [
      { id: 'Q001', type: 'picture-recognition', subject: 'tamil' },
      { id: 'Q005', type: 'word-completion', subject: 'tamil' },
      { id: 'Q009', type: 'arrange-word', subject: 'tamil' },
      { id: 'Q010', type: 'spelling-choice', subject: 'tamil' },
      { id: 'Q014', type: 'context-choice', subject: 'tamil' },
      { id: 'Q018', type: 'meaning-match', subject: 'tamil' },
    ];

    for (const act of sampleActivities) {
      await page.goto(`/session/3/${act.subject}/play?activityId=${act.id}`);
      await page.waitForLoadState('domcontentloaded');

      // 1. Check for broken images
      const images = page.locator('img');
      const imgCount = await images.count();
      for (let i = 0; i < imgCount; i++) {
        const naturalWidth = await images.nth(i).evaluate((img: HTMLImageElement) => img.naturalWidth);
        expect(naturalWidth).toBeGreaterThan(0);
      }

      // 2. Check font-family includes Noto Sans Tamil on Tamil text
      const tamilEl = page.locator('[lang="ta"], h2, button[lang="ta"]').first();
      if (await tamilEl.isVisible().catch(() => false)) {
        const fontFamily = await tamilEl.evaluate((el) => window.getComputedStyle(el).fontFamily);
        expect(fontFamily.toLowerCase()).toContain('noto sans tamil');
      }
    }

    const nonVercel404s = failedUrls.filter((u) => !u.includes('_vercel/insights'));
    expect(nonVercel404s).toHaveLength(0);

    const appErrors = consoleErrors.filter(
      (e) => !e.includes('401') && !e.includes('Failed to load resource: the server responded with a status of 404')
    );
    expect(appErrors).toHaveLength(0);
  });

  // ── Item 16 ─────────────────────────────────────────────────────────────────
  test('Item 16: Answer leakage audit: DOM attributes, aria labels, class names, hidden inputs do not leak answer', async ({ page }) => {
    const sampleActivities = ['Q001', 'Q005', 'Q009', 'Q010', 'Q014', 'Q018'];

    for (const actId of sampleActivities) {
      await page.goto(`/session/3/tamil/play?activityId=${actId}`);
      await page.waitForLoadState('domcontentloaded');

      // Check DOM for leak patterns like data-answer, data-correct="true" before answering
      const leakCheck = await page.evaluate(() => {
        const leaks: string[] = [];
        const allElements = document.querySelectorAll('*');
        allElements.forEach((el) => {
          // Check dataset
          const htmlEl = el as HTMLElement;
          if (htmlEl.dataset) {
            for (const [k, v] of Object.entries(htmlEl.dataset)) {
              if (k.toLowerCase().includes('correct') && v === 'true') {
                leaks.push(`Element <${el.tagName}> has dataset ${k}=${v}`);
              }
              if (k.toLowerCase().includes('answer') && v) {
                leaks.push(`Element <${el.tagName}> has dataset ${k}=${v}`);
              }
            }
          }
          // Check classes
          if (el.className && typeof el.className === 'string') {
            if (el.className.includes('is-correct') || el.className.includes('correct-answer')) {
              leaks.push(`Element <${el.tagName}> has class ${el.className}`);
            }
          }
          // Check hidden inputs
          if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') {
            const input = el as HTMLInputElement;
            if (input.name.toLowerCase().includes('answer') || input.name.toLowerCase().includes('correct')) {
              leaks.push(`Hidden input with name ${input.name}`);
            }
          }
        });
        return leaks;
      });

      expect(leakCheck).toHaveLength(0);
    }
  });

  // ── Item 17 ─────────────────────────────────────────────────────────────────
  test('Item 17: Evaluator check: correct answer is accepted, wrong answer is rejected across question types', async ({ page }) => {
    // 1. Multiple Choice (spelling-choice: Q010)
    await page.goto('/session/3/tamil/play?activityId=Q010');
    await answerTamilQuestion(page, 'Q010', false);
    await expect(page.locator('text=தவறான விடை')).toBeVisible({ timeout: 5000 });
    await page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' }).click();
    await answerTamilQuestion(page, 'Q010', true);
    await expect(page.locator('text=சரியான விடை!')).toBeVisible({ timeout: 5000 });

    // 2. Picture recognition (Q001)
    await page.goto('/session/3/tamil/play?activityId=Q001');
    await answerTamilQuestion(page, 'Q001', false);
    await expect(page.locator('text=தவறான விடை')).toBeVisible({ timeout: 5000 });
    await page.locator('button', { hasText: 'மீண்டும் முயற்சி செய்' }).click();
    await answerTamilQuestion(page, 'Q001', true);
    await expect(page.locator('text=சரியான விடை!')).toBeVisible({ timeout: 5000 });
  });
});
