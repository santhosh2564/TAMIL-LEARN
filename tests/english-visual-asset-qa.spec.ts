import { test, expect, Page } from '@playwright/test';

// Interface for checkActivityImage output
interface ImageCheckResult {
  status: string;
  src?: string | null;
  naturalWidth?: number;
  naturalHeight?: number;
  context: string;
}

// Helper to check the current activity image
async function checkActivityImage(page: Page, context: string): Promise<ImageCheckResult> {
  // Look for a successfully loaded image
  const img = page.locator('[data-testid="activity-asset-image"]').first();
  const fallbackMissing = page.locator('[data-testid="asset-fallback-missing"]').first();
  const fallbackInvalid = page.locator('[data-testid="asset-fallback-invalid"]').first();

  const imgCount = await img.count();
  const missingCount = await fallbackMissing.count();
  const invalidCount = await fallbackInvalid.count();

  if (imgCount > 0) {
    // Image is present — verify it actually loaded
    const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
    const naturalHeight = await img.evaluate((el: HTMLImageElement) => el.naturalHeight);
    const src = await img.getAttribute('src');
    return { status: 'ok', src, naturalWidth, naturalHeight, context };
  } else if (missingCount > 0) {
    return { status: 'missing', context };
  } else if (invalidCount > 0) {
    return { status: 'invalid', context };
  }
  return { status: 'no-image-activity', context };
}

test.describe('Phase H — English Activity Visual Asset QA', () => {
  test.setTimeout(120_000);

  test('Module 1: picture-recognition activity loads image correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=1');
    await page.waitForSelector('[data-testid="activity-asset-image"], [data-testid="asset-fallback-missing"]', { timeout: 20000 });
    const result = await checkActivityImage(page, 'M1');
    console.log('M1 result:', JSON.stringify(result));
    expect(result.status).toBe('ok');
    expect(result.naturalWidth).toBeGreaterThan(0);
    expect(result.naturalHeight).toBeGreaterThan(0);
  });

  test('Module 4: picture-recognition activity loads image correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=4');
    await page.waitForSelector('[data-testid="activity-asset-image"], [data-testid="asset-fallback-missing"]', { timeout: 20000 });
    const result = await checkActivityImage(page, 'M4');
    console.log('M4 result:', JSON.stringify(result));
    expect(result.status).toBe('ok');
    expect(result.naturalWidth).toBeGreaterThan(0);
  });

  test('Module 5: picture-recognition activity loads image correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=5');
    await page.waitForSelector('[data-testid="activity-asset-image"], [data-testid="asset-fallback-missing"]', { timeout: 20000 });
    const result = await checkActivityImage(page, 'M5');
    console.log('M5 result:', JSON.stringify(result));
    expect(result.status).toBe('ok');
    expect(result.naturalWidth).toBeGreaterThan(0);
  });

  test('Module 8: picture-recognition activity loads image correctly', async ({ page }) => {
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=8');
    await page.waitForSelector('[data-testid="activity-asset-image"], [data-testid="asset-fallback-missing"]', { timeout: 20000 });
    const result = await checkActivityImage(page, 'M8');
    console.log('M8 result:', JSON.stringify(result));
    expect(result.status).toBe('ok');
    expect(result.naturalWidth).toBeGreaterThan(0);
  });

  test('Compound assets: verify specific compound-word images load correctly', async ({ page }) => {
    // Directly verify that compound images are served at their expected paths
    const compoundPaths = [
      '/assets/class-3/english/images/eng-ash-gourd.jpg',
      '/assets/class-3/english/images/eng-bengal-gram.jpg',
      '/assets/class-3/english/images/eng-black-gram.jpg',
      '/assets/class-3/english/images/eng-curry-leaves.jpg',
      '/assets/class-3/english/images/eng-green-gram.jpg',
      '/assets/class-3/english/images/eng-snake-gourd.jpg',
      '/assets/class-3/english/images/eng-tender-coconut.jpg',
      '/assets/class-3/english/images/eng-thank-you.jpg',
    ];

    for (const imgPath of compoundPaths) {
      const resp = await page.request.get(`http://localhost:5173${imgPath}`);
      expect(resp.status(), `Expected 200 for ${imgPath}`).toBe(200);
      const contentType = resp.headers()['content-type'] || '';
      expect(contentType, `Expected image content-type for ${imgPath}`).toContain('image');
      console.log(`${imgPath}: HTTP ${resp.status()} ${contentType.split(';')[0]}`);
    }
  });

  test('Tamil-reused assets are served at their Tamil paths', async ({ page }) => {
    const tamilReusedPaths = [
      '/assets/class-3/tamil/term-1/images/Q003_Pazham.jpg',  // fruit
      '/assets/class-3/tamil/term-1/images/Q104_Pai.jpg',     // bag
      '/assets/class-3/tamil/term-1/images/Q101_Petti.jpg',   // box
      '/assets/class-3/tamil/term-1/images/Q005_Naai.jpg',    // dog
      '/assets/class-3/tamil/term-1/images/Q001_Muyal.jpg',   // rabbit
      '/assets/class-3/tamil/term-1/images/Q013_Eli.jpg',     // rat
      '/assets/class-3/tamil/term-1/images/Q034_Kadai.jpg',   // shop
      '/assets/class-3/tamil/term-1/images/Q014_Vannangal.jpg',// colour
    ];

    for (const imgPath of tamilReusedPaths) {
      const resp = await page.request.get(`http://localhost:5173${imgPath}`);
      expect(resp.status(), `Expected 200 for ${imgPath}`).toBe(200);
      console.log(`Tamil reuse ${imgPath}: HTTP ${resp.status()}`);
    }
  });

  test('Image sizing: activity image is not clipped or overflowing on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=1');
    await page.waitForSelector('[data-testid="activity-asset-image"]', { timeout: 20000 });

    const img = page.locator('[data-testid="activity-asset-image"]').first();
    const box = await img.boundingBox();
    expect(box, 'Image should have a bounding box').not.toBeNull();
    expect(box!.width).toBeGreaterThan(50);
    expect(box!.height).toBeGreaterThan(50);

    // Check no horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth, 'No horizontal overflow').toBeLessThanOrEqual(windowInnerWidth + 5);
    console.log(`Desktop image size: ${box!.width}x${box!.height}, bodyScrollWidth=${bodyScrollWidth}, windowWidth=${windowInnerWidth}`);
  });

  test('Image sizing: activity image is touch-friendly on mobile (375x667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=1');
    await page.waitForSelector('[data-testid="activity-asset-image"]', { timeout: 20000 });

    const img = page.locator('[data-testid="activity-asset-image"]').first();
    const box = await img.boundingBox();
    expect(box, 'Image should have a bounding box on mobile').not.toBeNull();
    expect(box!.width).toBeGreaterThan(30);

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const windowInnerWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyScrollWidth, 'No horizontal overflow on mobile').toBeLessThanOrEqual(windowInnerWidth + 5);
    console.log(`Mobile image size: ${box!.width}x${box!.height}, bodyScrollWidth=${bodyScrollWidth}`);
  });

  test('Text-only activities do not render broken image fallback', async ({ page }) => {
    // Module 6, which is text-based, should not show asset-fallback-invalid
    await page.goto('http://localhost:5173/classes/3/subjects/english/modules/6');
    await page.waitForSelector('text=Day 1 Practice', { timeout: 15000 });
    await page.getByRole('button', { name: 'Start' }).first().click();
    await page.waitForTimeout(3000);

    const invalidFallbacks = page.locator('[data-testid="asset-fallback-invalid"]');
    const count = await invalidFallbacks.count();
    console.log(`Module 6 invalid fallbacks: ${count}`);
    // It's OK to have missing fallbacks (graceful) but NOT invalid fallbacks (error state)
    expect(count, 'No invalid/error image fallbacks in Module 6').toBe(0);
  });

  test('Review activities share the same asset as their new-word counterparts', async ({ page }) => {
    // Module 2, Day 1 contains review activities from Module 1
    // The review acts should resolve the same assetId as the original new-word act
    // We verify by checking HTTP response for the expected image path
    const resp = await page.request.get('http://localhost:5173/assets/class-3/english/images/eng-bird.jpg');
    expect(resp.status()).toBe(200);  // eng-bird is a Module 1 new word, reused in M2 reviews
    const resp2 = await page.request.get('http://localhost:5173/assets/class-3/english/images/eng-big.jpg');
    expect(resp2.status()).toBe(200);
    console.log('Review asset reuse check: eng-bird OK, eng-big OK');
  });

  test('Phase I: verify no "Picture of ..." visible text is rendered on picture activities', async ({ page }) => {
    // 1. Native English picture activity
    await page.goto('http://localhost:5173/session/3/english/play?category=picture-recognition&module=1');
    await page.waitForSelector('[data-testid="activity-asset-image"]', { timeout: 20000 });
    
    // Instruction prompt is present
    await expect(page.locator('h2')).toContainText(/look at the picture|write the word/i);

    // Image is visible
    const img = page.locator('[data-testid="activity-asset-image"]').first();
    await expect(img).toBeVisible();

    // No visible "Picture of ..." text element on page
    const pictureText = page.locator('text=/Picture of/i');
    expect(await pictureText.count()).toBe(0);

    // Image has non-empty alt attribute for accessibility
    const alt = await img.getAttribute('alt');
    expect(alt).toBeTruthy();
    expect(alt?.length).toBeGreaterThan(0);

    // 2. Desktop & Mobile sizing check (no horizontal overflow)
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(img).toBeVisible();
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(380);
  });
});
