import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      // Server, scripts, and shared tests — node environment
      {
        test: {
          name: 'node-tests',
          include: [
            'scripts/**/*.ts',
            'apps/**/*.test.ts',
            'apps/**/*.spec.ts',
          ],
          environment: 'node',
        },
      },
      // Offline contextual replay harness — isolated node environment
      {
        test: {
          name: 'eval-tests',
          include: [
            'eval/**/*.test.ts',
            'eval/**/*.spec.ts',
          ],
          environment: 'node',
        },
      },
      // Web React component tests — jsdom environment with React plugin
      {
        plugins: [react()],
        test: {
          name: 'web-tests',
          include: [
            'apps/web/**/*.test.tsx',
            'apps/web/**/*.spec.tsx',
          ],
          environment: 'jsdom',
          setupFiles: ['./apps/web/src/test/setup.ts'],
        },
      },
    ],
  },
})
