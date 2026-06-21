# Story 5.2: Operator Pipeline & Health Monitoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **operator**,
I want to monitor bot connectivity, batch performance, queue state, and errors without the Ops Console UI,
So that I can diagnose pipeline state from the command line or any HTTP client during development.

## Acceptance Criteria

1. **AC-1: GET /api/ops/batch-status — operator batch diagnostics**
   - **Given** a request from localhost (or correct `X-Ops-Secret`), `OPS_ENABLED=true`, `NODE_ENV !== 'production'`
   - **When** `GET /api/ops/batch-status` is called
   - **Then** response is:
     ```json
     {
       "schedulerStatus": "idle" | "running",
       "lastBatchAt":      "<ISO-8601-UTC>" | null,
       "lastBatchDuration": 4200 | null,
       "queueDepth":        3,
       "lastBatchResult": {
         "filterMode":             "keyword_gate",
         "messagesFetched":        12,
         "signalsWritten":         5,
         "ignoredCount":           7,
         "preFilterDiscards":      3,
         "keywordMatchedCount":    9,
         "keywordSkippedCount":    2,
         "keywordAiSignalCount":   5,
         "keywordAiIgnoreCount":   4,
         "noKeywordAiSignalCount": 0,
         "noKeywordAiIgnoreCount": 0,
         "errors":                 null | "<error string>"
       } | null,
       "recentErrors": [{ "message": "...", "occurredAt": "<ISO-8601-UTC>" }]
     }
     ```
   - `schedulerStatus` is derived from the in-process `isRunning` flag exported via `isBatchRunning()` from `classifier/index.ts`.
   - `lastBatchAt`, `lastBatchDuration`, `lastBatchResult` sourced from the most recent `batch_health` row for the single active district (ordered by `completed_at DESC`, `completed_at IS NOT NULL`).
   - `queueDepth` = current pending `raw_messages` count for the active district: `prisma.rawMessage.count({ where: { district_id: district.id } })`.
   - `recentErrors` = last 10 failed `batch_health` rows for the active district where `error_message IS NOT NULL`, newest-first by `completed_at`, fields: `error_message` → `message`, `completed_at` → `occurredAt` (ISO UTC).
   - `filterMode` value must always be `'keyword_gate'` (current scope). Read from `batch_health.filter_mode` on the latest row; if null row, return `{ lastBatchResult: null }`.
   - All numeric fields within `lastBatchResult` map directly from `batch_health` snake_case columns to the camelCase response shape.
   - `lastBatchDuration`: compute as `(completed_at - started_at)` in milliseconds; null if no completed row.

2. **AC-2: GET /api/ops/system-health — infrastructure health**
   - **When** `GET /api/ops/system-health` is called under the same guard
   - **Then** response is:
     ```json
     {
       "database":  { "status": "ok" | "error", "latencyMs": 12 | null },
       "scheduler": { "status": "running" | "stopped", "nextRunInSeconds": 480 | null },
       "aiApi":     { "status": "ok" | "error" | "unknown", "lastCheckedAt": null },
       "bot":       { "status": "ok" | "error" },
       "botConnectivity": [
         { "mahallaId": 1, "mahallaName": "Навбаҳор маҳалласи", "botStatus": "active", "botLastSeenAt": "..." },
         { "mahallaId": 2, "mahallaName": "Олмазор маҳалласи",  "botStatus": "removed", "botLastSeenAt": "..." }
       ]
     }
     ```
   - **DB check:** `prisma.$queryRaw\`SELECT 1\`` with timing → `latencyMs`. Catch → `status='error'`, `latencyMs=null`.
   - **Scheduler check:** `status='running'` if `isBatchRunning()` is true, else `'stopped'`. `nextRunInSeconds=null` for Phase 1 (node-cron does not expose next-run time natively; null is acceptable).
   - **AI API:** `status='unknown'`, `lastCheckedAt=null` — AI health check is only on-demand (not auto-called to preserve quota). The architecture spec says "Test AI Connection" button fires on demand; this story only wires the auto data (`unknown`/`null` for now).
   - **Bot `status`:** `'ok'` if any mahalla has `bot_status = 'active'`; `'error'` if all mahallas in the district have `bot_status = 'removed'`.
   - **botConnectivity:** query `mahallas WHERE district_id = <active_district_id>`, return all with camelCase: `mahallaId`, `mahallaName`, `botStatus`, `botLastSeenAt` (ISO UTC string | null).
   - `botStatus` values in the response are the raw DB strings: `'active'` | `'removed'` | `'unknown'`.

3. **AC-3: Ops Console guard — identical to architecture spec**
   - Both endpoints return HTTP 404 when `NODE_ENV === 'production'` OR `OPS_ENABLED !== 'true'`.
   - When `OPS_ENABLED=true` and `OPS_SECRET` is set in env: requests without or with wrong `X-Ops-Secret` header return HTTP 403.
   - When `OPS_ENABLED=true` and `OPS_SECRET` is NOT set: requests from non-localhost IPs return HTTP 403.
   - Localhost = `req.ip === '127.0.0.1'` OR `req.ip === '::1'` OR `req.ip === '::ffff:127.0.0.1'`. Supertest and some Node/Express local requests resolve to IPv6-mapped loopback (`::ffff:127.0.0.1`), so the guard must accept it.

4. **AC-4: Env var wired — OPS_ENABLED and OPS_SECRET added to env schema**
   - `env.ts` must declare `OPS_ENABLED: z.string().optional()` and `OPS_SECRET: z.string().optional()`.
   - Guard check: `env.OPS_ENABLED === 'true'` (string comparison, not boolean coerce — keeps consistent with `.env` format).

5. **AC-5: `isBatchRunning()` exported from classifier/index.ts**
   - Add `export function isBatchRunning(): boolean { return isRunning }` to `classifier/index.ts`.
   - The module-level `isRunning` flag is already there — just expose a read-only accessor.
   - This avoids the ops module directly importing the internal boolean.

6. **AC-6: District resolution for ops endpoints**
   - Both endpoints resolve district via `prisma.district.findFirst({ where: { is_active: true } })` — same pattern as `runClassifyBatchWithLock`.
   - These are dev-facing endpoints; they are NOT session-authenticated (guarded by Ops guard instead). Do NOT apply `requireAuth` middleware to `/api/ops/*`.
   - If no active district is found, return `{ error: 'No active district' }` with HTTP 503.

7. **AC-7: Server entry wires the ops router**
   - `apps/server/src/web/index.ts` must mount `opsRouter` at `/api/ops` (NOT behind `requireAuth`; the ops guard replaces auth for these routes).
   - Mount BEFORE the `app.use('/api', requireAuth)` middleware — ops routes do not use session auth.

8. **AC-8: Tests pass**
   - `pnpm lint` and `pnpm test` pass.
   - Unit tests for `GET /api/ops/batch-status`:
     - Blocked: `NODE_ENV='production'` → 404
     - Blocked: `OPS_ENABLED !== 'true'` → 404
     - Blocked: non-localhost without `OPS_SECRET` → 403
     - Passes: localhost request → 200 with correct shape
     - Passes: correct `X-Ops-Secret` → 200
     - No active district → 503
     - `lastBatchResult: null` when no completed batch row
     - `queueDepth` populated from `rawMessage.count`
     - `recentErrors` populated from failed `batch_health` rows with `error_message`
     - `schedulerStatus: 'running'` when `isBatchRunning()` returns true
   - Unit tests for `GET /api/ops/system-health`:
     - Guard: `NODE_ENV='production'` → 404
     - DB healthy → `database.status='ok'`, `latencyMs >= 0`
     - DB error → `database.status='error'`, `latencyMs=null`
     - All mahallas removed → `bot.status='error'`
     - At least one mahalla active → `bot.status='ok'`
     - `botConnectivity` contains camelCase fields

---

## Tasks / Subtasks

- [x] Task 1: Export `isBatchRunning()` from `classifier/index.ts` (AC: 5)
  - [x] Add `export function isBatchRunning(): boolean { return isRunning }` after `runClassifyBatchWithLock`

- [x] Task 2: Extend `shared/env.ts` with `OPS_ENABLED` and `OPS_SECRET` (AC: 4)
  - [x] Add `OPS_ENABLED: z.string().optional()` and `OPS_SECRET: z.string().optional()` to `EnvSchema`

- [x] Task 3: Create `apps/server/src/ops/index.ts` — Ops router with guard + both endpoints (AC: 1, 2, 3, 6)
  - [x] Implement the Ops Console guard middleware (404 for production/disabled, 403 for secret mismatch/non-localhost)
  - [x] Implement `GET /api/ops/batch-status` handler (district resolution, latest batch_health query, failed batch_health query for recent errors, rawMessage.count queue depth, isBatchRunning)
  - [x] Implement `GET /api/ops/system-health` handler (prisma.$queryRaw timing, mahalla query, isBatchRunning)

- [x] Task 4: Mount ops router in `web/index.ts` BEFORE `requireAuth` (AC: 7)
  - [x] Import `opsRouter` from `../ops/index.js`
  - [x] Add `app.use('/api/ops', opsRouter)` BEFORE `app.use('/api', requireAuth)`

- [x] Task 5: Create `apps/server/src/ops/index.test.ts` — unit tests (AC: 8)
  - [x] Test guard behavior: production → 404, OPS_ENABLED=false → 404, wrong secret → 403, localhost including `::ffff:127.0.0.1` → 200
  - [x] Test batch-status endpoint: shape, null result, queueDepth, recentErrors, schedulerStatus
  - [x] Test system-health endpoint: db ok/error, bot ok/error, botConnectivity shape

- [x] Task 6: Verify all checks (AC: 8)
  - [x] `pnpm lint`
  - [x] `pnpm test` (327 tests, 25 files — added 27 new tests)
  - [x] `pnpm exec tsc -b apps/server/tsconfig.json`

---

## Dev Notes

### Architecture Compliance

**Module boundaries** (architecture.md §14):
| Module | Writes | Reads | Deletes |
|---|---|---|---|
| `ops/` | `raw_messages` (simulator, Story 6.2) | **all tables (read-only ops queries)** | `keywords` |

This story only implements read-only ops queries in `ops/`. No writes, no keyword CRUD — those are Story 6.x.

**No cross-module DB access:** `ops/index.ts` is the ops module owner. It may read all tables directly.

---

### File Map — What to CREATE and MODIFY

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/server/src/classifier/index.ts` | Export `isBatchRunning()` |
| MODIFY | `apps/server/src/shared/env.ts` | Add `OPS_ENABLED`, `OPS_SECRET` optional env vars |
| CREATE | `apps/server/src/ops/index.ts` | Ops router + guard + both endpoints |
| CREATE | `apps/server/src/ops/index.test.ts` | Unit tests for ops endpoints |
| MODIFY | `apps/server/src/web/index.ts` | Mount opsRouter BEFORE requireAuth |

**DO NOT MODIFY:** `health/index.ts` (dashboard health endpoint — different concern), `shared/types.ts` (HealthStatus interface is for future use), any frontend files (Story 6.x adds OpsPage UI), any `bot/`, `signals/`, or `classifier/` logic files (read-only access only from ops).

---

### CRITICAL: Mount Order in web/index.ts

The ops router **must** be mounted BEFORE `app.use('/api', requireAuth)`:

```typescript
// CORRECT order in web/index.ts:
app.use(express.json())
app.use(webhookRouter)
app.use('/api/auth', authRouter)
app.use('/api/ops', opsRouter)     // ← ops guard replaces auth; mount BEFORE requireAuth
app.use('/api', requireAuth)       // ← only applies to routes mounted AFTER this
app.use('/api', signalsRouter)
app.use('/api', healthRouter)
```

If `opsRouter` is mounted AFTER `requireAuth`, every ops request will fail with 401 before the ops guard runs. This is the most likely implementation mistake.

---

### Ops Guard Implementation (from architecture.md §6)

```typescript
// apps/server/src/ops/index.ts — full guard pattern
import { Router } from 'express'
import { env } from '../shared/env.js'

export const opsRouter = Router()

// Gate 1: disabled in production or when OPS_ENABLED !== 'true'
if (env.NODE_ENV === 'production' || env.OPS_ENABLED !== 'true') {
  opsRouter.all('*', (_req, res) => res.status(404).json({ error: 'Not found' }))
  // Export early — no routes registered
}

// Gate 2: localhost or OPS_SECRET check
opsRouter.use((req, res, next) => {
  const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'
  const providedSecret = req.header('X-Ops-Secret')

  if (env.OPS_SECRET) {
    // Secret is set — require it regardless of origin
    if (providedSecret !== env.OPS_SECRET) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    return next()
  }

  // No secret configured — localhost only
  if (!isLocalhost) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  return next()
})
```

**Important:** The `if (NODE_ENV === 'production' || OPS_ENABLED !== 'true')` early return pattern means you register `opsRouter.all('*', ...)` for the 404 case, but then the function continues. Use a structural pattern (export early or use a flag) to avoid accidentally registering real routes below the guard. The cleanest approach is to build the router conditionally or use a `return` after `opsRouter.all('*', ...)`.

Recommended pattern for clean guard:

```typescript
export const opsRouter = Router()

if (env.NODE_ENV === 'production' || env.OPS_ENABLED !== 'true') {
  opsRouter.all('*', (_req, res) => res.status(404).json({ error: 'Not found' }))
} else {
  // Register guard middleware
  opsRouter.use((req, res, next) => { /* secret/localhost check */ next() })

  // Register real routes below
  opsRouter.get('/batch-status', async (req, res) => { /* ... */ })
  opsRouter.get('/system-health', async (req, res) => { /* ... */ })
}
```

This is the pattern established in architecture.md §6.

---

### GET /api/ops/batch-status — Implementation Details

```typescript
opsRouter.get('/batch-status', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) {
      return res.status(503).json({ error: 'No active district' })
    }

    const [latestBatch, recentErrorBatches, queueDepth] = await Promise.all([
      prisma.batchHealth.findFirst({
        where: { district_id: district.id, completed_at: { not: null } },
        orderBy: { completed_at: 'desc' },
        select: {
          completed_at:               true,
          started_at:                 true,
          status:                     true,
          filter_mode:                true,
          messages_fetched:           true,
          signals_written:            true,
          ignored_count:              true,
          pre_filter_discards:        true,
          keyword_matched_count:      true,
          keyword_skipped_count:      true,
          keyword_ai_signal_count:    true,
          keyword_ai_ignore_count:    true,
          no_keyword_ai_signal_count: true,
          no_keyword_ai_ignore_count: true,
          error_message:              true,
        },
      }),
      prisma.batchHealth.findMany({
        where: {
          district_id:   district.id,
          completed_at:  { not: null },
          error_message: { not: null },
        },
        orderBy: { completed_at: 'desc' },
        take:    10,
        select:  { error_message: true, completed_at: true },
      }),
      prisma.rawMessage.count({
        where: { district_id: district.id },
      }),
    ])

    const lastBatchAt = latestBatch?.completed_at?.toISOString() ?? null
    const lastBatchDuration = latestBatch?.completed_at && latestBatch?.started_at
      ? latestBatch.completed_at.getTime() - latestBatch.started_at.getTime()
      : null

    const lastBatchResult = latestBatch ? {
      filterMode:               latestBatch.filter_mode,
      messagesFetched:          latestBatch.messages_fetched,
      signalsWritten:           latestBatch.signals_written,
      ignoredCount:             latestBatch.ignored_count,
      preFilterDiscards:        latestBatch.pre_filter_discards,
      keywordMatchedCount:      latestBatch.keyword_matched_count,
      keywordSkippedCount:      latestBatch.keyword_skipped_count,
      keywordAiSignalCount:     latestBatch.keyword_ai_signal_count,
      keywordAiIgnoreCount:     latestBatch.keyword_ai_ignore_count,
      noKeywordAiSignalCount:   latestBatch.no_keyword_ai_signal_count,
      noKeywordAiIgnoreCount:   latestBatch.no_keyword_ai_ignore_count,
      errors:                   latestBatch.error_message ?? null,
    } : null

    const recentErrors = recentErrorBatches.flatMap(batch => {
      if (batch.completed_at === null) return []
      return [{
        message:    batch.error_message ?? 'Unknown error',
        occurredAt: batch.completed_at.toISOString(),
      }]
    })

    return res.json({
      schedulerStatus:  isBatchRunning() ? 'running' : 'idle',
      lastBatchAt,
      lastBatchDuration,
      queueDepth,
      lastBatchResult,
      recentErrors,
    })
  } catch (err) {
    logger.error({ err }, 'Ops batch-status query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Batch status query failed' })
  }
})
```

**Key implementation details:**
- `recentErrors` uses failed `batch_health` rows, not `pipeline_events`. Current code writes batch failures to `batch_health.error_message`; it does not currently create `pipeline_events` with `event_type='error'`.
- `queueDepth` is current pending raw message count for the district and must always be numeric.
- `lastBatchDuration` is always milliseconds (integer).
- `batch_health.error_message` is written by batch-processor when classification fails. If a selected failed row has a null message despite the filter, fallback to `'Unknown error'`.

---

### GET /api/ops/system-health — Implementation Details

```typescript
opsRouter.get('/system-health', async (_req, res) => {
  try {
    const district = await prisma.district.findFirst({ where: { is_active: true } })
    if (!district) {
      return res.status(503).json({ error: 'No active district' })
    }

    // DB check with timing
    const dbStart = Date.now()
    let dbStatus: 'ok' | 'error' = 'ok'
    let dbLatencyMs: number | null = null
    try {
      await prisma.$queryRaw`SELECT 1`
      dbLatencyMs = Date.now() - dbStart
    } catch {
      dbStatus = 'error'
    }

    // Bot connectivity from mahallas
    const mahallas = await prisma.mahalla.findMany({
      where:  { district_id: district.id },
      select: { id: true, name: true, bot_status: true, bot_last_seen_at: true },
    })

    const botConnectivity = mahallas.map(m => ({
      mahallaId:    m.id,
      mahallaName:  m.name,
      botStatus:    m.bot_status as 'active' | 'removed' | 'unknown',
      botLastSeenAt: m.bot_last_seen_at?.toISOString() ?? null,
    }))

    // Overall bot status: ok if ANY mahalla is active, error if ALL are removed
    const hasActive = mahallas.some(m => m.bot_status === 'active')
    const botStatus: 'ok' | 'error' = hasActive ? 'ok' : 'error'

    return res.json({
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      scheduler: {
        status:          isBatchRunning() ? 'running' : 'stopped',
        nextRunInSeconds: null,  // node-cron does not expose next-run time; null is Phase 1 acceptable
      },
      aiApi: {
        status:        'unknown',  // on-demand only; not auto-called (quota protection)
        lastCheckedAt: null,
      },
      bot:            { status: botStatus },
      botConnectivity,
    })
  } catch (err) {
    logger.error({ err }, 'Ops system-health query failed')
    return res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'System health query failed' })
  }
})
```

**Key implementation details:**
- `prisma.$queryRaw\`SELECT 1\`` is Prisma's tagged template literal syntax. Import `Prisma` namespace if needed or use directly as a method call.
- `bot.status='error'` when `mahallas.length === 0` (no mahallas in district) OR all have `bot_status !== 'active'`.
- `aiApi.status='unknown'` is intentional — auto-run would burn API quota. See architecture-ops-console.md §7.
- `scheduler.nextRunInSeconds=null` — node-cron v4 does not expose next-run time without a workaround. Accepted Phase 1 limitation.

---

### Test File Pattern (from Story 5.1 and connectivity.test.ts)

Follow the established `vi.hoisted()` + `vi.mock()` pattern. For `ops/index.test.ts`:

```typescript
// Top of file — mocks declared BEFORE imports
const mockEnv = vi.hoisted(() => ({
  DATABASE_URL:            'postgresql://test:test@localhost:5432/test',
  NODE_ENV:                'test' as const,
  PORT:                    3001,
  BOT_TOKEN:               'test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test-secret',
  FILTER_MODE:             'keyword_gate' as const,
  AI_API_KEY:              'test-key',
  AI_MODEL:                'gemini-2.5-flash',
  SESSION_SECRET:          'test-session-secret',
  OPS_ENABLED:             'true',     // enable ops in tests by default
  OPS_SECRET:              undefined as string | undefined,
}))
vi.mock('../shared/env.js', () => ({ env: mockEnv }))

// Mock isBatchRunning from classifier
const mockIsBatchRunning = vi.hoisted(() => vi.fn().mockReturnValue(false))
vi.mock('../classifier/index.js', () => ({
  isBatchRunning:             mockIsBatchRunning,
  runClassifyBatchWithLock:   vi.fn(),
}))

// Mock prisma
const mockDistrictFindFirst   = vi.hoisted(() => vi.fn())
const mockBatchHealthFindFirst = vi.hoisted(() => vi.fn())
const mockBatchHealthFindMany = vi.hoisted(() => vi.fn())
const mockRawMessageCount      = vi.hoisted(() => vi.fn())
const mockMahallaFindMany      = vi.hoisted(() => vi.fn())
const mockQueryRaw             = vi.hoisted(() => vi.fn())
vi.mock('../shared/db.js', () => ({
  prisma: {
    district:      { findFirst: mockDistrictFindFirst },
    batchHealth:   { findFirst: mockBatchHealthFindFirst, findMany: mockBatchHealthFindMany },
    rawMessage:    { count: mockRawMessageCount },
    mahalla:       { findMany: mockMahallaFindMany },
    $queryRaw:     mockQueryRaw,
  },
}))
```

**Test app pattern** — do NOT apply `requireAuth` to the test app for ops routes:

```typescript
function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/ops', opsRouter)   // no requireAuth — ops guard handles access control
  return app
}
```

**Testing the guard:** To test production blocking, you need to re-import `opsRouter` AFTER setting `mockEnv.NODE_ENV = 'production'`. Because the guard condition runs at module initialization (when the module is first imported), you cannot test different guard states on the same module instance. Use `vi.isolateModules()` or separate test files for guard tests if needed.

Alternatively — and this is the simpler pattern established by the architecture — test the guard behavior with `mockEnv.OPS_ENABLED` and `mockEnv.OPS_SECRET`:

```typescript
it('returns 404 when OPS_ENABLED is not true', async () => {
  mockEnv.OPS_ENABLED = 'false'
  // Re-require the module so the guard re-evaluates
  // OR: test via the secret/localhost middleware path only (since NODE_ENV='test' is not 'production')
})
```

> ⚠️ **Guard test complexity:** Because `if (NODE_ENV === 'production' || OPS_ENABLED !== 'true')` runs at module load time, testing the 404-guard path requires module re-isolation. A pragmatic approach: implement the guard as a middleware function that reads `env` at request time, not at module load time. This makes all guard behaviors testable without module re-import:
>
> ```typescript
> opsRouter.use((req, res, next) => {
>   // Check at REQUEST time, not module load time
>   if (env.NODE_ENV === 'production' || env.OPS_ENABLED !== 'true') {
>     return res.status(404).json({ error: 'Not found' })
>   }
>   const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1'
>   if (env.OPS_SECRET) {
>     if (req.header('X-Ops-Secret') !== env.OPS_SECRET) return res.status(403).json({ error: 'Forbidden' })
>     return next()
>   }
>   if (!isLocalhost) return res.status(403).json({ error: 'Forbidden' })
>   return next()
> })
> ```
>
> This combined middleware is the recommended implementation approach for this story — it enables full guard testing without module isolation tricks.

---

### env.ts Schema Extension

```typescript
// apps/server/src/shared/env.ts — add these two optional fields to EnvSchema:
OPS_ENABLED: z.string().optional(),   // 'true' | 'false' | undefined
OPS_SECRET:  z.string().optional(),   // any non-empty string | undefined
```

Note: `z.string().optional()` makes these fields completely optional (undefined if absent from `.env`). The guard reads `env.OPS_ENABLED === 'true'` (string equality, not truthy check).

---

### Previous Story Intelligence (from Story 5.1)

- **Pattern — `Promise.all` parallel queries:** Used in Story 5.1 `health/index.ts` — apply same pattern for `batch-status` (parallel: latest batchHealth + failed batchHealth + rawMessage.count queries).
- **Pattern — district_id always from session for dashboard routes.** For ops routes, district is resolved via `prisma.district.findFirst({ where: { is_active: true } })` — NOT from session (ops endpoints are not session-authenticated).
- **Pattern — `.js` imports:** All TypeScript imports within `apps/server/src/` use `.js` extension (e.g., `'../shared/db.js'`). Follow without exception.
- **Pattern — error shape:** `{ statusCode: N, error: '...', message: '...' }` for all 4xx/5xx responses.
- **Pattern — structured logger:** `logger.error({ err, ...context }, 'message')` — no string interpolation.
- **Test pattern — `vi.hoisted()` + `vi.mock()` before imports:** Established in `health/index.test.ts` and `connectivity.test.ts`. Follow exactly.
- **Test count baseline:** 300 tests / 24 files before this story. New story should add meaningful test count.
- **`pnpm test` scope:** runs all Vitest tests in workspace root. Always run from project root.

---

### Git Intelligence (recent commits)

```
a25bc7f feat(story-5.1): implement dashboard health endpoint reliability
2a37a59 docs(story): advance sprint progress and prepare story 5.1
3d9abe3 feat(story-4.3): implement district-scoped signal context endpoint
```

Pattern: `feat(story-X.Y):` prefix for implementation commits, `docs(story):` for validation/story-creation commits.

---

### Project Context Reference

- **Stack:** Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma 7.8.0, PostgreSQL, Vitest
- **Test runner:** `pnpm test` (Vitest, workspace root)
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/server/tsconfig.json`
- **Story location:** `_bmad-output/implementation-artifacts/`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Prisma schema:** `prisma/schema.prisma` (source of truth)
- **DB model for bot connectivity:** `mahallas` table, fields: `id`, `name`, `telegram_chat_id`, `bot_status` ('active'|'removed'|'unknown'), `bot_last_seen_at` (DateTime?)
- **DB model for batch diagnostics:** `batch_health` table — all columns with snake_case → camelCase mapping for response
- **DB model for queue state:** `raw_messages` table — count pending rows with `district_id = active district`
- **DB model for recent errors:** `batch_health.error_message` on failed/completed rows — current implementation does not write `pipeline_events` with `event_type='error'`
- **`districtId` for ops:** from `prisma.district.findFirst({ where: { is_active: true } })`, NOT from session
- **Module boundary:** `ops/` reads all tables; bot-connectivity data is in `mahallas` table (owned by bot module conceptually, but readable by ops per architecture §14 module table)

---

## Dev Agent Record

### File List

| Status | File |
|--------|------|
| MODIFIED | `apps/server/src/classifier/index.ts` |
| MODIFIED | `apps/server/src/shared/env.ts` |
| MODIFIED | `apps/server/src/web/index.ts` |
| CREATED  | `apps/server/src/ops/index.ts` |
| CREATED  | `apps/server/src/ops/index.test.ts` |

### Completion Notes

- **AC-5:** Exported `isBatchRunning()` as a read-only accessor for the module-level `isRunning` flag in `classifier/index.ts`.
- **AC-4:** Added `OPS_ENABLED: z.string().optional()` and `OPS_SECRET: z.string().optional()` to `EnvSchema` in `shared/env.ts`.
- **AC-3/AC-6/AC-1/AC-2:** Created `ops/index.ts` with a **combined guard middleware** (request-time env check pattern per story note — avoids module-load-time guard, enabling full testability without `vi.isolateModules`). Both `/batch-status` and `/system-health` endpoints implemented per AC specs.
- **AC-7:** Mounted `opsRouter` at `/api/ops` in `web/index.ts` BEFORE `app.use('/api', requireAuth)` — critical ordering preserved.
- **AC-8:** 27 unit tests covering all guard states, including non-localhost without `OPS_SECRET`, batch-status shape/null/errors/schedulerStatus, system-health db/bot/botConnectivity. Used `vi.resetAllMocks()` + explicit defaults pattern (avoids mock queue starvation across tests). Results: 327/327 tests pass, `pnpm lint` clean, `pnpm exec tsc -b apps/server/tsconfig.json` clean.
- **TypeScript fix:** Added `IRouter` explicit type annotation to `opsRouter` export to satisfy TSC portability requirement (same pattern as `healthRouter`).
- **Review:** Code review completed; missing AC-8 non-localhost/no-secret guard test was added and verified. Story is ready for the next BMAD step.

### Change Log

- 2026-06-21: Implemented Story 5.2 — Ops router with guard, batch-status, system-health endpoints, env vars, and 26 unit tests.

---

## Story Completion Status

- Implementation readiness: done
- Implemented: 2026-06-21
- Reviewed: 2026-06-21
- Next: Proceed to the next BMAD workflow step
