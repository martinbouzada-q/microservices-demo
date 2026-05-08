import { defineConfig, devices } from '@playwright/test';
import { baseURL } from './config/urls';
import { env } from './config/env';

export default defineConfig({
  testDir: './specs',
  testMatch: '**/*.e2e.spec.ts',
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 2 : 0,
  workers: env.CI ? 1 : undefined,

  reporter: env.CI
    ? [['list'], ['html', { open: 'never' }], ['junit', { outputFile: 'test-results/junit.xml' }]]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit',   use: { ...devices['Desktop Safari'] } },
  ],

  // App runs on Kubernetes — start it externally before invoking tests:
  //   kubectl port-forward deployment/frontend 8080:8080
});
