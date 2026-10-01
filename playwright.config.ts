import { defineConfig, devices } from '@playwright/test'
import { loadEnv } from 'vite'
import { resolvePort } from './config/ports.mjs'

const fileEnv = loadEnv('test', process.cwd(), '')
const e2ePort = resolvePort(process.env.E2E_PORT, fileEnv.E2E_PORT, 'E2E_PORT', 4173)
const configuredBaseUrl = process.env.E2E_BASE_URL ?? fileEnv.E2E_BASE_URL
const externalBaseUrl = configuredBaseUrl?.trim() || undefined
const localBaseUrl = `http://127.0.0.1:${e2ePort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: externalBaseUrl ?? localBaseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  ...(externalBaseUrl
    ? {}
    : {
        webServer: {
          command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${e2ePort} --strictPort`,
          url: localBaseUrl,
          reuseExistingServer: !process.env.CI,
        },
      }),
})
