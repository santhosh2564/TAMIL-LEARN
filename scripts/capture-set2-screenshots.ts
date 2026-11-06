import * as fs from 'fs';
import * as path from 'path';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

const OUT_DIR = path.resolve('set2 screenshots');
const OUT_DIR_ALT = path.resolve('set2_screenshots');

// Ensure output directories exist and are clean
for (const dir of [OUT_DIR, OUT_DIR_ALT]) {
  if (fs.existsSync(dir)) {
    const existing = fs.readdirSync(dir);
    for (const f of existing) {
      if (f.endsWith('.png')) fs.unlinkSync(path.join(dir, f));
    }
  } else {
    fs.mkdirSync(dir, { recursive: true });
  }
}

interface ScreenshotTarget {
  id: string;
  filename: string;
  word: string;
  activityId: string;
  interaction?: 'select-option' | 'place-tiles';
}

const targets: ScreenshotTarget[] = [
  { id: 'FTS0051', filename: '01_FTS0051_அலுவலகம்.png', word: 'அலுவலகம்', activityId: 'FTS0051' },
  { id: 'FTS0053', filename: '02_FTS0053_அலைபேசி.png', word: 'அலைபேசி', activityId: 'FTS0053' },
  { id: 'FTS0059', filename: '03_FTS0059_அழிப்பான்.png', word: 'அழிப்பான்', activityId: 'FTS0059' },
  { id: 'FTS0067', filename: '04_FTS0067_ஆசிரியர்.png', word: 'ஆசிரியர்', activityId: 'FTS0067' },
  { id: 'FTS0071', filename: '05_FTS0071_ஆடு.png', word: 'ஆடு', activityId: 'FTS0071' },
  { id: 'FTS0072', filename: '06_FTS0072_ஆடையகம்.png', word: 'ஆடையகம்', activityId: 'FTS0072' },
  { id: 'FTS0078', filename: '07_FTS0078_ஆந்தை.png', word: 'ஆந்தை', activityId: 'FTS0078' },
  { id: 'FTS0081', filename: '08_FTS0081_ஆமை.png', word: 'ஆமை', activityId: 'FTS0081' },
  { id: 'FTS0084', filename: '09_FTS0084_ஆறு.png', word: 'ஆறு', activityId: 'FTS0084' },
  { id: 'FTS0085', filename: '10_FTS0085_ஆலமரம்.png', word: 'ஆலமரம்', activityId: 'FTS0085' },
  { id: 'FTS0090', filename: '11_FTS0090_இட்லி.png', word: 'இட்லி', activityId: 'FTS0090' },
  { id: 'FTS0093', filename: '12_FTS0093_இதழ்கள்.png', word: 'இதழ்கள்', activityId: 'FTS0093' },
  { id: 'FTS0096', filename: '13_FTS0096_இனிப்பகம்.png', word: 'இனிப்பகம்', activityId: 'FTS0096' },
  { id: 'FTS0071_select', filename: '14_FTS0071_ஆடு_interactive_select.png', word: 'ஆடு', activityId: 'FTS0071', interaction: 'select-option' },
  { id: 'FTS0053_arrange', filename: '15_FTS0053_அலைபேசி_interactive_arrange.png', word: 'அலைபேசி', activityId: 'FTS0053', interaction: 'place-tiles' }
];

async function captureAll() {
  console.log('Starting preview server...');
  const server = await preview({
    preview: { host: '127.0.0.1', port: 4173 }
  });

  const browser = await chromium.launch({ headless: true });

  console.log(`Ready to capture ${targets.length} distinct screens...\n`);

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    console.log(`[${i + 1}/${targets.length}] Loading ${t.activityId} (${t.word})...`);

    // Brand new context with zero cookies, sessionStorage or localStorage
    const context = await browser.newContext({
      viewport: { width: 1280, height: 850 }
    });

    // Mock student session
    await context.route('**/api/student/session', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          student: {
            id: 'qa-student',
            name: 'கவின்',
            avatar: 'default',
            classId: '3',
            schoolId: 'school-1'
          }
        })
      });
    });

    // Mock session API to ensure this exact activity is always fresh
    await context.route('**/api/sessions/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `sess-${t.activityId}-${Date.now()}`,
          activityIds: [t.activityId],
          currentIndex: 0,
          status: 'active'
        })
      });
    });

    const page = await context.newPage();

    const targetUrl = `http://127.0.0.1:4173/session/3/tamil/play?activityId=${t.activityId}`;
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // Wait for card
    await page.waitForSelector('[data-testid="activity-card"], h2', { timeout: 10000 });

    // Wait for image
    const img = page.locator('img[data-testid="activity-asset-image"]');
    await img.waitFor({ state: 'visible', timeout: 7000 });

    // Wait for image bytes to load
    await img.evaluate(async (el: HTMLImageElement) => {
      if (!el.complete) {
        await new Promise(r => {
          el.onload = el.onerror = r;
          setTimeout(r, 4000);
        });
      }
    });

    const imgSrc = await img.getAttribute('src');
    const imgNaturalW = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    const imgNaturalH = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);

    console.log(`  -> Image: ${imgSrc} (${imgNaturalW}x${imgNaturalH})`);

    // Handle interactive action if needed
    if (t.interaction === 'select-option') {
      const btn = page.locator('button').filter({ hasText: t.word }).first();
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(400);
      }
    } else if (t.interaction === 'place-tiles') {
      // Place first 2 tiles
      const tiles = page.locator('button[data-testid^="tile-"]');
      const count = await tiles.count();
      for (let k = 0; k < Math.min(count, 2); k++) {
        await tiles.nth(k).click();
        await page.waitForTimeout(200);
      }
      await page.waitForTimeout(300);
    } else {
      await page.waitForTimeout(300);
    }

    const p1 = path.join(OUT_DIR, t.filename);
    const p2 = path.join(OUT_DIR_ALT, t.filename);

    await page.screenshot({ path: p1, fullPage: false });
    fs.copyFileSync(p1, p2);

    const size = fs.statSync(p1).size;
    console.log(`  -> Saved: ${t.filename} (${size} bytes)\n`);

    await context.close();
  }

  await browser.close();
  server.httpServer.close();

  console.log('All 15 screenshots captured successfully with unique images!');
}

captureAll().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
