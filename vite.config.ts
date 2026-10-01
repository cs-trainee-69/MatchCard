import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolvePort } from './config/ports.mjs'

export default defineConfig(({ mode }) => {
  const fileEnv = loadEnv(mode, process.cwd(), '')
  const port = resolvePort(process.env.PORT, fileEnv.PORT, 'PORT', 5173)

  return {
    plugins: [react()],
    publicDir: 'assets',
    server: {
      port,
      strictPort: true,
    },
    preview: {
      port,
      strictPort: true,
    },
  }
})
