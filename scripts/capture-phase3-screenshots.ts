import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import path from 'path';

process.env.SESSION_SECRET = 'temporary-session-secret-for-screenshot-capture-32chars!';

async function main() {
  console.log('Starting Vite server...');
  const server = await createServer({
    configFile: path.resolve(process.cwd(), 'vite.config.ts'),
    server: { port: 5173 },
  });
  await server.listen();
  console.log('Vite server running on http://localhost:5173');

  const artifactDir = 'C:\\Users\\santh\\.gemini\\antigravity\\brain\\917dc67e-db82-46f2-9c6c-88f691790c7a';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Mock API routes for class roster
  await page.route('**/api/classes/by-code/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: {
          id: 'cls_2a',
          name: 'வகுப்பு 2A (Class 2A)',
          grade: 'Class 2',
          classCode: 'K7M9PX',
        },
        students: [
          { id: 's1', name: 'கவிதா', avatar: 'avatar_sun' },
          { id: 's2', name: 'ரவி', avatar: 'avatar_star' },
          { id: 's3', name: 'பிரியா', avatar: 'avatar_sun' },
          { id: 's4', name: 'அன்பு', avatar: 'avatar_star' },
          { id: 's5', name: 'மீனா', avatar: 'avatar_sun' },
          { id: 's6', name: 'செல்வன்', avatar: 'avatar_star' },
        ],
      }),
    });
  });

  // Mock class cards print route
  await page.route('**/api/admin/classes/*/cards', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        class: {
          id: 'cls_2a',
          school_id: 'sch_1',
          name: 'வகுப்பு 2A (Class 2A)',
          grade: 'Class 2',
          class_code: 'K7M9PX',
        },
        students: [
          { id: 's1', name: 'கவிதா (Kavitha)', rollNo: '01', avatar: 'avatar_sun', isLocked: false },
          { id: 's2', name: 'ரவி (Ravi)', rollNo: '02', avatar: 'avatar_star', isLocked: false },
          { id: 's3', name: 'பிரியா (Priya)', rollNo: '03', avatar: 'avatar_sun', isLocked: false },
          { id: 's4', name: 'அன்பு (Anbu)', rollNo: '04', avatar: 'avatar_star', isLocked: false },
        ],
      }),
    });
  });

  // 1. Screenshot Class Roster Page
  console.log('Navigating to Class Roster Page...');
  await page.goto('http://localhost:5173/c/K7M9PX');
  await page.waitForSelector('text=உங்கள் பெயரைத் தொடவும்!');
  const rosterPath = path.join(artifactDir, 'screenshot-class-roster.png');
  await page.screenshot({ path: rosterPath });
  console.log('Saved:', rosterPath);

  // 2. Open Picture PIN Modal
  console.log('Opening Picture PIN modal...');
  await page.click('text=கவிதா');
  await page.waitForSelector('text=வணக்கம் கவிதா!');
  const pinPath = path.join(artifactDir, 'screenshot-pin-modal.png');
  await page.screenshot({ path: pinPath });
  console.log('Saved:', pinPath);

  // 3. Screenshot Print Class Cards Page
  console.log('Navigating to Print Cards Page...');
  await page.goto('http://localhost:5173/admin/classes/cls_2a/print');
  await page.waitForSelector('text=Sara Learning Platform');
  // Wait a moment for QR codes to render
  await page.waitForTimeout(800);
  const printCardPath = path.join(artifactDir, 'screenshot-print-card.png');
  await page.screenshot({ path: printCardPath });
  console.log('Saved:', printCardPath);

  await browser.close();
  await server.close();
  console.log('All screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
