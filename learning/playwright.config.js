import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 45000,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', headless: true, ...(process.env.PLAYWRIGHT_CHANNEL === '' ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium') }) },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview web --outDir ../dist --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 30000,
  },
  reporter: [['list']],
});
