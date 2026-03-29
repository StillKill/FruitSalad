import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  timeout: 60000,
  workers: 4,
  use: {
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm start',
    url: 'http://127.0.0.1:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 }
      }
    },
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 7']
      }
    }
  ]
});
