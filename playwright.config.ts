import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * The only Playwright config. Every e2e spec runs against `vite preview` whose
 * DATABASE_URL is TEST_DATABASE_URL for that process only — never production.
 *   npm run test:e2e            (builds, then runs every spec)
 * A student is logged in through /c/:code + picture PIN in global setup and used as
 * the default storageState; specs that need fresh contexts create their own.
 */
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('TEST_DATABASE_URL is not set.');
}
if (process.env.DATABASE_URL && testDbUrl.trim() === process.env.DATABASE_URL.trim()) {
  throw new Error('TEST_DATABASE_URL equals DATABASE_URL (production). Refusing to run.');
}
if (testDbUrl.includes('ep-late-haze-b593dxrs')) {
  throw new Error('TEST_DATABASE_URL points at the production endpoint (ep-late-haze-b593dxrs). Refusing to run.');
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  expect: { timeout: 10000 },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  globalSetup: './tests/e2e/helpers/globalSetup.ts',
  globalTeardown: './tests/e2e/helpers/globalTeardown.ts',
  use: {
    baseURL: 'http://localhost:4173',
    storageState: '.auth/student.json',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/api/health',
    reuseExistingServer: false,
    timeout: 60000,
    stdout: 'pipe',
    env: {
      DATABASE_URL: testDbUrl,
      DATABASE_URL_UNPOOLED: testDbUrl,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
