import { defineConfig, devices } from '@playwright/test';

// Critical-path E2E suite for DevRoom 1.0.
//
// REQUIRES a staging environment: the app must be served (preview or dev)
// against a staging Supabase project with migrations 1-8 applied, plus two
// test users. Provide via environment:
//
//   E2E_BASE_URL          (default http://localhost:4173)
//   E2E_USER_A_EMAIL / E2E_USER_A_PASSWORD
//   E2E_USER_B_EMAIL / E2E_USER_B_PASSWORD
//
// Without these, the suite self-skips. Browsers are NOT installed by
// `npm install`; run `npx playwright install chromium` explicitly.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
