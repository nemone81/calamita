import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/extract/**'], thresholds: { lines: 80, functions: 80 } },
  },
})
