import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e-local',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Pixel 5'], baseURL: 'http://127.0.0.1:4175' },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --mode development --host 127.0.0.1 --port 4175 --strictPort',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
  },
})
