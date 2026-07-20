/**
 * scripts/run-schema-integration-tests.ts
 *
 * Guarded wrapper for schema integration tests against a real PostgreSQL database.
 *
 * Safety invariants enforced before any child process runs:
 *  1. TEST_DATABASE_URL must be defined.
 *  2. The target database name must end with '_test' or '_disposable'.
 *  3. TEST_DATABASE_URL must NOT resolve to the same host:port/database as DATABASE_URL.
 *  4. Never logs credential strings.
 *
 * After guards pass:
 *  - Injects TEST_DATABASE_URL as DATABASE_URL into child processes.
 *  - Runs `prisma migrate deploy` against the guarded test database.
 *  - Runs the dedicated serial schema-test Vitest project.
 */
import { spawnSync } from 'child_process'
import * as dotenv from 'dotenv'
import {
  formatDatabaseTarget,
  validateSchemaTestTarget,
} from './schema-test-guard.js'

dotenv.config()

// ─── Guard: TEST_DATABASE_URL must be defined ─────────────────────────────────

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  console.error('❌  TEST_DATABASE_URL must be defined for schema integration tests.')
  console.error('    Add it to your .env file (DB name must end with _test or _disposable).')
  process.exit(1)
}

const devUrl = process.env.DATABASE_URL
let testTarget
try {
  testTarget = validateSchemaTestTarget(testUrl, devUrl)
} catch (error) {
  const message = error instanceof Error ? error.message : 'Invalid database target'
  console.error(`❌  ${message}. Refusing to continue.`)
  process.exit(1)
}

// ─── All guards passed — log safe info only ───────────────────────────────────

console.log(`✅  Test database guard passed: target = ${formatDatabaseTarget(testTarget)}`)
console.log('    Running prisma migrate deploy on test database...')

// Inject test URL as DATABASE_URL for all child processes
const childEnv = { ...process.env, DATABASE_URL: testUrl }

// ─── Step 1: Apply migrations to the test database ───────────────────────────

const deployResult = spawnSync(
  'pnpm exec prisma migrate deploy',
  [],
  { env: childEnv, stdio: 'inherit', shell: true }
)
if (deployResult.status !== 0) {
  console.error('❌  prisma migrate deploy failed on test database.')
  process.exit(1)
}

// ─── Step 2: Run the serial schema integration test project ──────────────────

console.log('\n    Running schema integration tests (serial)...\n')

const testResult = spawnSync(
  'pnpm exec vitest run --config vitest.schema.config.ts',
  [],
  { env: childEnv, stdio: 'inherit', shell: true }
)
if (testResult.status !== 0) {
  console.error('❌  Schema integration tests failed.')
  process.exit(1)
}

console.log('\n✅  Schema integration tests passed.')
