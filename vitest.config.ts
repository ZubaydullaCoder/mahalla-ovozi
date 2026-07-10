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
      // Web React component tests — jsdom environment with React plugin
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        plugins: [react() as any],
        test: {
          name: 'web-tests',
          include: [
            'apps/web/**/*.test.tsx',
            'apps/web/**/*.spec.tsx',
          ],
          environment: 'jsdom',
        },
      },
    ],
  },
})
