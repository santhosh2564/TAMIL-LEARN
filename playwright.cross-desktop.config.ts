import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

/**
 * Runs tests/e2e/cross-desktop.spec.ts against `vite preview` whose DATABASE_URL is
 * TEST_DATABASE_URL for this run only. Build first: `npx vite build`.
 *   npx playwright test -c playwright.cross-desktop.config.ts
 */
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error('TEST_DATABASE_URL is not set.');
}
if (process.env.DATABASE_URL && testDbUrl.trim() === process.env.DATABASE_URL.trim()) {
  throw new Error('TEST_DATABASE_URL equals DATABASE_URL (production). Refusing to run.');
}

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'cross-desktop.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 180000,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
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
