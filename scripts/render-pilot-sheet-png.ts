import { chromium } from '@playwright/test';
import path from 'path';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
  const filePath = path.resolve('docs/contact-sheets/pilot_15_contact_sheet.html');
  await page.goto(`file://${filePath}`);
  await page.waitForLoadState('networkidle');
  const outPng = path.resolve('docs/contact-sheets/pilot_15_contact_sheet.png');
  await page.screenshot({ path: outPng, fullPage: true });
  await browser.close();
  console.log(`Rendered contact sheet to ${outPng}`);
}

main();
