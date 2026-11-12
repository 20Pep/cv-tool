import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node bin/cv-tool.js',
    url: 'http://127.0.0.1:3200/api/health',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      CVTOOL_PORT: '3200',
      CVTOOL_LAUNCH_TOKEN: 'e2e-launch',
      CVTOOL_SESSION_TOKEN: 'e2e-session',
      CVTOOL_DATA_DIR: '.e2e-data',
      CVTOOL_NO_OPEN: '1',
    },
  },
});
