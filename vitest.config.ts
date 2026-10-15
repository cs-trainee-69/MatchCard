import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: { __CAT_CARD_LOCAL_DEVELOPMENT__: false },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'config/**/*.test.ts'],
  },
})
