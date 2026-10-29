import { defineConfig } from '@playwright/test';
import base from './playwright.config';

/** QA run: same TEST-database setup as playwright.config.ts, with HTML/JSON reports. */
export default defineConfig({
  ...base,
  testDir: './tests/e2e',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'qa-report/html-report', open: 'never' }],
    ['json', { outputFile: 'qa-report/playwright-results.json' }],
  ],
  use: {
    ...base.use,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
