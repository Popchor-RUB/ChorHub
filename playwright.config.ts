import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { authStatePaths, e2eConfig } from './e2e/config';

const htmlReportDir = path.join(e2eConfig.artifactDir, 'playwright-report');
const testResultsDir = path.join(e2eConfig.artifactDir, 'test-results');

export default defineConfig({
  testDir: './e2e',
  outputDir: testResultsDir,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never', outputFolder: htmlReportDir }], ['list']],

  use: {
    baseURL: e2eConfig.baseUrl,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1280, height: 720 },
    locale: 'de-DE',
  },

  globalSetup: './e2e/global-setup.ts',

  projects: [
    {
      name: 'admin-auth',
      testDir: './e2e/admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePaths.admin,
      },
    },
    {
      name: 'member-auth',
      testDir: './e2e/member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePaths.member,
      },
    },
    {
      name: 'no-auth',
      testMatch: /e2e\/auth\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
