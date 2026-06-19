# Story 5.1: Health API — GET /api/health Endpoint

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **developer**,
I want a `GET /api/health` endpoint that exposes structured pipeline health data for the dashboard delay banner,
So that the frontend can accurately display whether signal data is current or delayed.

## Acceptance Criteria

1. **AC-1: Authenticated-only** — Unauthenticated request returns HTTP 401. `requireAuth` middleware already wired on `app.use('/api', requireAuth)` in `web/index.ts`.

2. **AC-2: Full response shape** — Authenticated `GET /api/health` reads the latest `batch_health` row for `req.session.districtId` where `completed_at IS NOT NULL` (most recent completed batch), and returns:
   ```json
   {
     "status": "current" | "delayed" | "no_data",
     "lastBatchAt": "ISO-8601-UTC" | null,
     "lastBatchStatus": "success" | "failed" | null,
     "messagesProcessed": 2 | null,
     "signalsWritten": 1 | null,
     "queueDepth": 3
   }
   ```

3. **AC-3: Status derivation** — `status` is:
   - `'no_data'` — when `lastBatchAt` is `null` (no completed batch exists yet)
   - `'delayed'` — when `lastBatchAt` is not null AND `>= 25 minutes ago`
   - `'current'` — when `lastBatchAt` is not null AND `< 25 minutes ago`
   - **Note:** Threshold is `>= 25 minutes` (inclusive of exactly 25 minutes → delayed).

4. **AC-4: `lastBatchStatus` mapping** — derived from `batch_health.status` (`'ok'` → `'success'`, `'failed'` → `'failed'`). Returns `null` when no completed row.

5. **AC-5: `queueDepth`** — always present (never null) — count of pending `raw_messages` for the district: `prisma.rawMessage.count({ where: { district_id: districtId } })`.

6. **AC-6: No operator-only data** — This endpoint does NOT expose: `errorMessage`, `filterMode`, `preFilterDiscards`, `keywordMatchedCount`, `keywordSkippedCount`, or any other operator-only fields. Those belong to `GET /api/ops/batch-status` (Epic 5.2+).

7. **AC-7: All absent values are `null` not `undefined`** — `messagesProcessed`, `signalsWritten`, `lastBatchStatus` are `null` when no completed batch exists.

8. **AC-8: Tests pass** — `pnpm lint` and `pnpm test` pass. Unit tests cover:
   - `no_data` state: no completed batch rows → `status='no_data'`, all nullable fields are `null`, `queueDepth` is numeric
   - `current` state: `completed_at` < 25 minutes ago → `status='current'`, all fields populated
   - `delayed` state: `completed_at` >= 25 minutes ago → `status='delayed'`
   - exactly 25 min threshold → `'delayed'`
   - `queueDepth` sourced from `rawMessage.count` query with correct `district_id` scope
   - `lastBatchStatus` maps `'ok'` → `'success'` and `'failed'` → `'failed'`
   - unauthenticated → 401
   - Prisma throws → 500 with logger context
   - dashboard treats `status='no_data'` as an unavailable/delayed state and renders the existing no-data delay banner

---

## Tasks / Subtasks

- [ ] Task 1: Expand `health/index.ts` — replace the TODO stub with the full Story 5.1 health response (AC: 1–7)
  - [ ] Add `rawMessage.count` for `queueDepth` in parallel with `batchHealth.findFirst`
  - [ ] Extend `batchHealth.findFirst` select to include `status`, `signals_written`, `messages_fetched`
  - [ ] Implement `status` derivation: `no_data` when `lastBatchAt === null`, else `>= 25 min` → `'delayed'`, `< 25 min` → `'current'`
  - [ ] Map `batch_health.status` → `lastBatchStatus`: `'ok'` → `'success'`, `'failed'` → `'failed'`, null → `null`
  - [ ] Return full shape with camelCase keys; absent optionals → `null`

- [ ] Task 2: Update dashboard health API type + banner condition (AC: 2, 3)
  - [ ] Add `lastBatchStatus: 'success' | 'failed' | null`
  - [ ] Add `messagesProcessed: number | null`
  - [ ] Add `signalsWritten: number | null`
  - [ ] Add `queueDepth: number`
  - [ ] Add `'no_data'` to the `status` union type
  - [ ] Update `apps/web/src/pages/dashboard-page.tsx` so `status === 'no_data'` also renders the existing `DelayBanner` with `lastBatchAt=null`

- [ ] Task 3: Replace `health/index.test.ts` — rewrite tests to match the full Story 5.1 shape (AC: 8)
  - [ ] Mock both `prisma.batchHealth.findFirst` and `prisma.rawMessage.count`
  - [ ] Test all status states: `no_data`, `current`, `delayed`, exactly-25-min
  - [ ] Use `vi.useFakeTimers()` + `vi.setSystemTime()` + `vi.useRealTimers()` for the exact-25-min threshold test so it proves inclusive boundary behavior without clock drift
  - [ ] Test `queueDepth` is always present and sourced from `rawMessage.count`
  - [ ] Test `lastBatchStatus` mapping (`'ok'` → `'success'`, `'failed'` → `'failed'`)
  - [ ] Remove the old assertion `expect(Object.keys(res.body).sort()).toEqual(['lastBatchAt', 'status'])` — new shape has more fields
  - [ ] Retain 401 and 500 tests

- [ ] Task 4: Add focused frontend coverage for `no_data` banner behavior (AC: 8)
  - [ ] Add `apps/web/src/pages/dashboard-page.test.tsx` if no dashboard page test file exists yet
  - [ ] Mock `useHealth()` to return `{ status: 'no_data', lastBatchAt: null, ... }`
  - [ ] Assert the existing Uzbek Cyrillic no-data delay banner text is rendered
  - [ ] Assert `status='current'` does not render the delay banner

- [ ] Task 5: Verify all checks pass (AC: 8)
  - [ ] `pnpm lint`
  - [ ] `pnpm test` (baseline: 295 tests, 23 test files — net should increase)
  - [ ] `pnpm exec tsc -b apps/server/tsconfig.json`
  - [ ] `pnpm exec tsc -b apps/web/tsconfig.json`

---

## Dev Notes

### Architecture Compliance

**File Map — What to MODIFY:**

| Action | File | Purpose |
|--------|------|---------|
| MODIFY | `apps/server/src/health/index.ts` | Replace stub with full health response shape |
| MODIFY | `apps/server/src/health/index.test.ts` | Rewrite tests to match new shape |
| MODIFY | `apps/web/src/api/health.ts` | Extend `DashboardHealthStatus` type |
| MODIFY | `apps/web/src/pages/dashboard-page.tsx` | Treat `no_data` as unavailable/delayed for the existing banner |
| CREATE | `apps/web/src/pages/dashboard-page.test.tsx` | Cover `no_data` banner rendering if no dashboard page test exists |

**DO NOT MODIFY:** `shared/types.ts` `HealthStatus` interface (it is the operator-facing full type, not the dashboard-facing type — leave it as is for Ops Console stories), `web/index.ts`, `DelayBanner` component behavior, any signal files, any auth files.

> ⚠️ **CRITICAL — Architecture vs. Reality Mismatch:** The architecture doc describes `health/routes.ts` and `health/query.ts` as separate files. The actual codebase has a single `health/index.ts`. **DO NOT create `routes.ts` or `query.ts` files.** Keep the single-file structure consistent with the existing implementation pattern. The architecture doc was aspirational for Phase 1; the established pattern across this codebase is `index.ts` + `index.test.ts` (see `signals/`, `auth/`).

---

### CRITICAL — Existing Test File Must Be Replaced

The existing `health/index.test.ts` (222 lines) was written for the **old stub shape** (`{ lastBatchAt, status }` only). It explicitly asserts at line 219:

```typescript
expect(Object.keys(res.body).sort()).toEqual(['lastBatchAt', 'status'])
```

This test **will fail** after Story 5.1 adds new fields. You **must rewrite** (not extend) the test file. The full new response shape has 6 keys: `lastBatchAt`, `lastBatchStatus`, `messagesProcessed`, `queueDepth`, `signalsWritten`, `status`.

The test mock must cover **both** Prisma calls:
```typescript
const mockBatchHealthFindFirst = vi.hoisted(() => vi.fn())
const mockRawMessageCount = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    batchHealth: { findFirst: mockBatchHealthFindFirst },
    rawMessage:  { count: mockRawMessageCount },
  },
}))
```

---

### `health/index.ts` — Full Implementation Target

```typescript
// apps/server/src/health/index.ts
import { Router, type IRouter } from 'express'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

export const healthRouter: IRouter = Router()

const DELAY_THRESHOLD_MS = 25 * 60 * 1000 // 25 minutes (inclusive → delayed)

healthRouter.get('/health', async (req, res) => {
  const districtId = req.session.districtId
  if (districtId === undefined) {
    return res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  }

  try {
    // Run both queries in parallel — independent, no race
    const [latest, queueDepth] = await Promise.all([
      prisma.batchHealth.findFirst({
        where: {
          district_id: districtId,
          completed_at: { not: null },
        },
        orderBy: { completed_at: 'desc' },
        select: {
          completed_at:    true,
          status:          true,
          signals_written: true,
          messages_fetched: true,
        },
      }),
      prisma.rawMessage.count({
        where: { district_id: districtId },
      }),
    ])

    const completedAt = latest?.completed_at ?? null
    const lastBatchAt = completedAt?.toISOString() ?? null

    // status derivation
    let status: 'current' | 'delayed' | 'no_data'
    if (completedAt === null) {
      status = 'no_data'
    } else {
      const ageMs = Date.now() - completedAt.getTime()
      status = ageMs >= DELAY_THRESHOLD_MS ? 'delayed' : 'current'
    }

    // lastBatchStatus mapping: 'ok' → 'success', 'failed' → 'failed', absent → null
    let lastBatchStatus: 'success' | 'failed' | null = null
    if (latest !== null) {
      lastBatchStatus = latest.status === 'ok' ? 'success' : 'failed'
    }

    return res.json({
      status,
      lastBatchAt,
      lastBatchStatus,
      messagesProcessed: latest?.messages_fetched ?? null,
      signalsWritten:    latest?.signals_written ?? null,
      queueDepth,
    })
  } catch (err) {
    logger.error({ err, districtId }, 'Health endpoint query failed')
    return res.status(500).json({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Health check failed',
    })
  }
})
```

**Key implementation details:**
- `Promise.all([...])` — parallel queries; neither depends on the other.
- `districtId` guard at the top: the `requireAuth` middleware already handles 401 for missing session, but since `index.ts` is self-contained for testing, guard explicitly.
- `completedAt` local variable avoids non-null assertions and keeps the status derivation type-safe.
- `queueDepth` is always a number (never null) — `rawMessage.count` always returns an integer, including 0 when the table is empty.
- `messagesProcessed` uses `messages_fetched` DB column — this is the total fetched in the batch run (raw messages before classification).

---

### `health/index.test.ts` — Rewrite Target Shape

```typescript
// apps/server/src/health/index.test.ts
// (Rewritten for Story 5.1 — replaces the stub-era test file entirely)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'

// ─── vi.hoisted mocks ─────────────────────────────────────────────────────────

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
}))

vi.mock('../shared/env.js', () => ({ env: mockEnv }))

// ─── Prisma mock ──────────────────────────────────────────────────────────────

const mockBatchHealthFindFirst = vi.hoisted(() => vi.fn())
const mockRawMessageCount      = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    batchHealth: { findFirst: mockBatchHealthFindFirst },
    rawMessage:  { count:     mockRawMessageCount },
  },
}))

// ─── Logger mock ──────────────────────────────────────────────────────────────

const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('../shared/logger.js', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}))

import { healthRouter } from './index.js'
import { requireAuth }   from '../auth/middleware.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  }))

  app.post('/test/login', (req, res) => {
    req.session.userId     = req.body.userId     as number
    req.session.districtId = req.body.districtId as number
    res.json({ ok: true })
  })

  app.use('/api', requireAuth)
  app.use('/api', healthRouter)
  return app
}

const SESSION_DISTRICT_ID = 7

describe('GET /api/health', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Authentication ──────────────────────────────────────────────────────────

  it('returns 401 for unauthenticated requests', async () => {
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' })
  })

  // ── no_data state ───────────────────────────────────────────────────────────

  it('returns status no_data with null nullable fields when no completed batch exists', async () => {
    mockBatchHealthFindFirst.mockResolvedValueOnce(null)
    mockRawMessageCount.mockResolvedValueOnce(5)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      status:            'no_data',
      lastBatchAt:       null,
      lastBatchStatus:   null,
      messagesProcessed: null,
      signalsWritten:    null,
      queueDepth:        5,
    })
  })

  // ── current state ───────────────────────────────────────────────────────────

  it('returns status current when completed_at is less than 25 minutes ago', async () => {
    const recentDate = new Date(Date.now() - 10 * 60 * 1000) // 10 min ago
    mockBatchHealthFindFirst.mockResolvedValueOnce({
      completed_at:     recentDate,
      status:           'ok',
      signals_written:  3,
      messages_fetched: 10,
    })
    mockRawMessageCount.mockResolvedValueOnce(2)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      status:            'current',
      lastBatchAt:       recentDate.toISOString(),
      lastBatchStatus:   'success',
      messagesProcessed: 10,
      signalsWritten:    3,
      queueDepth:        2,
    })
  })

  // ── delayed state ───────────────────────────────────────────────────────────

  it('returns status delayed when completed_at is more than 25 minutes ago', async () => {
    const oldDate = new Date(Date.now() - 30 * 60 * 1000) // 30 min ago
    mockBatchHealthFindFirst.mockResolvedValueOnce({
      completed_at:     oldDate,
      status:           'ok',
      signals_written:  1,
      messages_fetched: 4,
    })
    mockRawMessageCount.mockResolvedValueOnce(0)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('delayed')
    expect(res.body.lastBatchAt).toBe(oldDate.toISOString())
  })

  // ── exactly 25-min threshold → delayed ─────────────────────────────────────

  it('returns status delayed when completed_at is exactly 25 minutes ago', async () => {
    const fixedNow = new Date('2026-06-19T10:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)

    const exactThreshold = new Date(fixedNow.getTime() - 25 * 60 * 1000)
    mockBatchHealthFindFirst.mockResolvedValueOnce({
      completed_at:     exactThreshold,
      status:           'ok',
      signals_written:  0,
      messages_fetched: 0,
    })
    mockRawMessageCount.mockResolvedValueOnce(0)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('delayed')
  })

  // ── lastBatchStatus: failed batch ──────────────────────────────────────────

  it('maps batch_health.status "failed" → lastBatchStatus "failed"', async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000)
    mockBatchHealthFindFirst.mockResolvedValueOnce({
      completed_at:     recentDate,
      status:           'failed',
      signals_written:  0,
      messages_fetched: 3,
    })
    mockRawMessageCount.mockResolvedValueOnce(3)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.lastBatchStatus).toBe('failed')
  })

  // ── District scoping ────────────────────────────────────────────────────────

  it('queries batchHealth and rawMessage with req.session.districtId only', async () => {
    mockBatchHealthFindFirst.mockResolvedValueOnce(null)
    mockRawMessageCount.mockResolvedValueOnce(0)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })
    await agent.get('/api/health')

    expect(mockBatchHealthFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district_id: SESSION_DISTRICT_ID }),
      }),
    )
    expect(mockRawMessageCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ district_id: SESSION_DISTRICT_ID }),
      }),
    )
  })

  // ── queueDepth always numeric ───────────────────────────────────────────────

  it('returns queueDepth 0 when no pending raw messages', async () => {
    mockBatchHealthFindFirst.mockResolvedValueOnce(null)
    mockRawMessageCount.mockResolvedValueOnce(0)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body.queueDepth).toBe(0)
  })

  // ── Response shape — full key set ──────────────────────────────────────────

  it('returns exactly the 6 expected keys — no extras, no missing', async () => {
    const recentDate = new Date(Date.now() - 5 * 60 * 1000)
    mockBatchHealthFindFirst.mockResolvedValueOnce({
      completed_at:     recentDate,
      status:           'ok',
      signals_written:  2,
      messages_fetched: 5,
    })
    mockRawMessageCount.mockResolvedValueOnce(1)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual([
      'lastBatchAt', 'lastBatchStatus', 'messagesProcessed',
      'queueDepth', 'signalsWritten', 'status',
    ])
  })

  // ── Prisma failure → 500 ───────────────────────────────────────────────────

  it('returns 500 and logs when Prisma throws', async () => {
    const dbError = new Error('DB connection refused')
    // Simulate Promise.all rejection from either query
    mockBatchHealthFindFirst.mockRejectedValueOnce(dbError)
    mockRawMessageCount.mockResolvedValueOnce(0)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/health')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Health check failed',
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: dbError, districtId: SESSION_DISTRICT_ID }),
      'Health endpoint query failed',
    )
  })
})
```

---

### `apps/web/src/api/health.ts` — Type Update

```typescript
// apps/web/src/api/health.ts
// Intentional frontend API-boundary type — do NOT import from apps/server
import { useQuery } from '@tanstack/react-query'

export interface DashboardHealthStatus {
  status:            'current' | 'delayed' | 'no_data'
  lastBatchAt:       string | null   // ISO 8601 UTC
  lastBatchStatus:   'success' | 'failed' | null
  messagesProcessed: number | null
  signalsWritten:    number | null
  queueDepth:        number
}

async function fetchHealth(): Promise<DashboardHealthStatus> {
  const res = await fetch('/api/health', {
    credentials: 'same-origin',
  })

  if (!res.ok) {
    throw new Error(`GET /api/health failed: ${res.status}`)
  }

  return res.json() as Promise<DashboardHealthStatus>
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60000,
  })
}
```

### `dashboard-page.tsx` — `no_data` Banner Handling

The existing `DelayBanner` already supports `lastBatchAt=null` and displays the Uzbek Cyrillic no-data message. Story 5.1 must update only the dashboard condition so the new API state renders that existing banner:

```typescript
const isDelayed = healthData?.status === 'delayed' || healthData?.status === 'no_data'
```

Do not change `DelayBanner` copy or styling in this story.

---

### Scope Boundary — What This Story Is NOT

Story 5.1 scope is **backend endpoint expansion + frontend type sync**. It does NOT include:
- `GET /api/ops/batch-status` or `GET /api/ops/system-health` (Epic 5.2)
- Pipeline idempotency / restart safety (Epic 5.3)
- Ops Console UI for health (Epic 6.5)
- `hokim_related` bot connectivity checks (Epic 5.2)
- Any new dashboard UI components (already built in Epic 3)
- Any `DelayBanner` component copy/styling changes

---

### Previous Story Intelligence (from Story 4.3)

- **Pattern — `Promise.all` parallel queries:** Story 4.3 established the `querySignalById` + `queryContextSignals` sequential pattern. Story 5.1 uses `Promise.all` instead since both queries are fully independent. This is the right choice here.
- **Pattern — district_id always from session:** Story 4.3 reinforced — never accept district info from request body or params; always use `req.session.districtId`.
- **Pattern — `.js` imports:** All TypeScript imports within `apps/server/src/` use `.js` extension (e.g., `'../shared/db.js'`). Follow this without exception.
- **Pattern — test mock structure:** Follow the `vi.hoisted()` + `vi.mock()` pattern used throughout (see `index.test.ts` for signals, auth, health). Always place `vi.hoisted()` calls before `vi.mock()` factories.
- **Test count baseline:** 295 tests / 23 test files before this story.

---

### Git Intelligence (recent commits)

```
3d9abe3 feat(story-4.3): implement district-scoped signal context endpoint
28c327b docs(story): validate story 4.3 context drawer API & verify readiness
33980b7 docs: create and review story 4.3 context drawer API endpoint
```

Recent pattern: `feat(story-X.Y):` prefix for implementation commits, `docs(story):` for validation.

---

### Project Context Reference

- **Stack:** Node `^20.19.0`, pnpm `10.34.1`, Express 4.x, Prisma 7.8.0, PostgreSQL, Vitest
- **Test runner:** `pnpm test` (Vitest, workspace root)
- **Lint:** `pnpm lint` (ESLint)
- **Type check:** `pnpm exec tsc -b apps/server/tsconfig.json`
- **Story location:** `_bmad-output/implementation-artifacts/`
- **Sprint status:** `_bmad-output/implementation-artifacts/sprint-status.yaml`
- **Prisma schema source of truth:** `prisma/schema.prisma`
- **All production user-facing strings must be Uzbek Cyrillic** (no new strings in this story)
- **`districtId` always from session** — never from request body

---

## Story Completion Status

- Implementation readiness: ready-for-dev
- Context engine analysis: completed — comprehensive developer guide created
- Next: Run `bmad-dev-story` to implement, then `bmad-code-review`
