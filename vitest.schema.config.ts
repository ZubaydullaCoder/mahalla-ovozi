/**
 * vitest.schema.config.ts
 *
 * Dedicated Vitest configuration for real-database schema integration tests.
 *
 * - Serial (pool: 'forks', maxForks: 1) to prevent concurrent DB mutations.
 * - Only includes the schema integration test file.
 * - This project is EXCLUDED from the default vitest.config.ts to prevent
 *   accidental destructive DB operations during normal test runs.
 * - Invoked only via: pnpm test:schema (guarded wrapper)
 */
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'schema-integration',
    include: [
      'apps/server/src/topics/schema.integration.test.ts',
      'apps/server/src/topics/intake/drain.integration.test.ts',
    ],
    environment: 'node',
    // Serial execution: single worker to prevent concurrent DB mutations
    maxWorkers: 1,
    minWorkers: 1,
    reporters: ['verbose'],
  },
})
