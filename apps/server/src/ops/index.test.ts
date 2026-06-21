// apps/server/src/ops/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// ─── vi.hoisted mocks — MUST be declared before any imports ───────────────────

const mockEnv = vi.hoisted(() => ({
  DATABASE_URL:            'postgresql://test:test@localhost:5432/test',
  NODE_ENV:                'test' as 'test' | 'development' | 'production',
  PORT:                    3001,
  BOT_TOKEN:               'test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test-secret',
  FILTER_MODE:             'keyword_gate' as const,
  AI_API_KEY:              'test-key',
  AI_MODEL:                'gemini-2.5-flash',
  SESSION_SECRET:          'test-session-secret',
  OPS_ENABLED:             'true' as string | undefined,
  OPS_SECRET:              undefined as string | undefined,
}))
vi.mock('../shared/env.js', () => ({ env: mockEnv }))

// isBatchRunning mock
const mockIsBatchRunning = vi.hoisted(() => vi.fn().mockReturnValue(false))
vi.mock('../classifier/index.js', () => ({
  isBatchRunning:           mockIsBatchRunning,
  runClassifyBatchWithLock: vi.fn(),
  purgeOldSignals:          vi.fn(),
}))

// Prisma mock
const mockDistrictFindFirst    = vi.hoisted(() => vi.fn())
const mockBatchHealthFindFirst = vi.hoisted(() => vi.fn())
const mockBatchHealthFindMany  = vi.hoisted(() => vi.fn())
const mockRawMessageCount      = vi.hoisted(() => vi.fn())
const mockMahallaFindMany      = vi.hoisted(() => vi.fn())
const mockQueryRaw             = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    district:    { findFirst: mockDistrictFindFirst },
    batchHealth: { findFirst: mockBatchHealthFindFirst, findMany: mockBatchHealthFindMany },
    rawMessage:  { count: mockRawMessageCount },
    mahalla:     { findMany: mockMahallaFindMany },
    $queryRaw:   mockQueryRaw,
  },
}))

// Logger mock
vi.mock('../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { opsRouter } from './index.js'

// ─── Test app factory ─────────────────────────────────────────────────────────
// No requireAuth — ops guard handles access control
function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/ops', opsRouter)
  return app
}

function createRemoteIpTestApp() {
  const app = express()
  app.use(express.json())
  app.use((_req, _res, next) => {
    Object.defineProperty(_req, 'ip', {
      configurable: true,
      value:        '203.0.113.10',
    })
    next()
  })
  app.use('/api/ops', opsRouter)
  return app
}

// ─── Shared fixture data ──────────────────────────────────────────────────────

const ACTIVE_DISTRICT = { id: 1, is_active: true }

const LATEST_BATCH = {
  completed_at:               new Date('2026-06-21T10:00:00.000Z'),
  started_at:                 new Date('2026-06-21T09:59:55.800Z'),
  filter_mode:                'keyword_gate',
  messages_fetched:           12,
  signals_written:            5,
  ignored_count:              7,
  pre_filter_discards:        3,
  keyword_matched_count:      9,
  keyword_skipped_count:      2,
  keyword_ai_signal_count:    5,
  keyword_ai_ignore_count:    4,
  no_keyword_ai_signal_count: 0,
  no_keyword_ai_ignore_count: 0,
  error_message:              null,
}

const MAHALLAS = [
  { id: 1, name: 'Навбаҳор маҳалласи', bot_status: 'active',  bot_last_seen_at: new Date('2026-06-21T10:00:00.000Z') },
  { id: 2, name: 'Олмазор маҳалласи',  bot_status: 'removed', bot_last_seen_at: null },
]

// ─── Reset helper — sets safe defaults for all mocks before each test ─────────
function resetMocks() {
  vi.resetAllMocks()
  // Guard is open by default
  mockEnv.NODE_ENV   = 'test'
  mockEnv.OPS_ENABLED = 'true'
  mockEnv.OPS_SECRET  = undefined
  // isBatchRunning defaults to false
  mockIsBatchRunning.mockReturnValue(false)
  // Prisma defaults: active district + empty/zero results
  mockDistrictFindFirst.mockResolvedValue(ACTIVE_DISTRICT)
  mockBatchHealthFindFirst.mockResolvedValue(null)
  mockBatchHealthFindMany.mockResolvedValue([])
  mockRawMessageCount.mockResolvedValue(0)
  mockMahallaFindMany.mockResolvedValue([])
  mockQueryRaw.mockResolvedValue([])
}

// ─── Guard tests ──────────────────────────────────────────────────────────────

describe('Ops guard', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when NODE_ENV is production', async () => {
    mockEnv.NODE_ENV = 'production'
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Not found' })
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Not found' })
  })

  it('returns 404 when OPS_ENABLED is undefined', async () => {
    mockEnv.OPS_ENABLED = undefined
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(404)
  })

  it('returns 403 when OPS_SECRET is set and X-Ops-Secret header is missing', async () => {
    mockEnv.OPS_SECRET = 'supersecret'
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'Forbidden' })
  })

  it('returns 403 when OPS_SECRET is set and wrong header provided', async () => {
    mockEnv.OPS_SECRET = 'supersecret'
    const res = await request(app)
      .get('/api/ops/batch-status')
      .set('X-Ops-Secret', 'wrongsecret')
    expect(res.status).toBe(403)
  })

  it('returns 200 when correct X-Ops-Secret header is provided', async () => {
    mockEnv.OPS_SECRET = 'supersecret'
    const res = await request(app)
      .get('/api/ops/batch-status')
      .set('X-Ops-Secret', 'supersecret')
    expect(res.status).toBe(200)
  })

  it('returns 200 for localhost request without secret configured', async () => {
    // Supertest routes through loopback — Guard accepts ::ffff:127.0.0.1
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
  })

  it('returns 403 for non-localhost request without secret configured', async () => {
    app = createRemoteIpTestApp()
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ error: 'Forbidden' })
  })
})

// ─── GET /api/ops/batch-status ────────────────────────────────────────────────

describe('GET /api/ops/batch-status', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 503 when no active district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns lastBatchResult: null when no completed batch row', async () => {
    // defaults: ACTIVE_DISTRICT, null batch, [], 0
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
    expect(res.body.lastBatchResult).toBeNull()
    expect(res.body.lastBatchAt).toBeNull()
    expect(res.body.lastBatchDuration).toBeNull()
  })

  it('returns correct shape with a completed batch row', async () => {
    mockBatchHealthFindFirst.mockResolvedValue(LATEST_BATCH)
    mockRawMessageCount.mockResolvedValue(3)

    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      schedulerStatus:   'idle',
      lastBatchAt:       LATEST_BATCH.completed_at.toISOString(),
      lastBatchDuration: LATEST_BATCH.completed_at.getTime() - LATEST_BATCH.started_at.getTime(),
      queueDepth:        3,
      recentErrors:      [],
    })
    expect(res.body.lastBatchResult).toMatchObject({
      filterMode:               'keyword_gate',
      messagesFetched:          12,
      signalsWritten:           5,
      ignoredCount:             7,
      preFilterDiscards:        3,
      keywordMatchedCount:      9,
      keywordSkippedCount:      2,
      keywordAiSignalCount:     5,
      keywordAiIgnoreCount:     4,
      noKeywordAiSignalCount:   0,
      noKeywordAiIgnoreCount:   0,
      errors:                   null,
    })
  })

  it('returns schedulerStatus: "running" when isBatchRunning() is true', async () => {
    mockIsBatchRunning.mockReturnValue(true)
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
    expect(res.body.schedulerStatus).toBe('running')
  })

  it('returns queueDepth populated from rawMessage.count', async () => {
    mockRawMessageCount.mockResolvedValue(42)
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
    expect(res.body.queueDepth).toBe(42)
  })

  it('returns recentErrors populated from failed batch_health rows', async () => {
    const errorBatches = [
      { error_message: 'AI quota exceeded', completed_at: new Date('2026-06-21T09:00:00.000Z') },
      { error_message: 'Timeout',           completed_at: new Date('2026-06-21T08:00:00.000Z') },
    ]
    mockBatchHealthFindMany.mockResolvedValue(errorBatches)

    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(200)
    expect(res.body.recentErrors).toHaveLength(2)
    expect(res.body.recentErrors[0]).toMatchObject({
      message:    'AI quota exceeded',
      occurredAt: errorBatches[0].completed_at.toISOString(),
    })
    expect(res.body.recentErrors[1]).toMatchObject({
      message:    'Timeout',
      occurredAt: errorBatches[1].completed_at.toISOString(),
    })
  })

  it('returns 500 on Prisma error in batch health query', async () => {
    mockBatchHealthFindFirst.mockRejectedValue(new Error('DB failure'))
    const res = await request(app).get('/api/ops/batch-status')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Batch status query failed',
    })
  })
})

// ─── GET /api/ops/system-health ───────────────────────────────────────────────

describe('GET /api/ops/system-health', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when NODE_ENV is production', async () => {
    mockEnv.NODE_ENV = 'production'
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(404)
  })

  it('returns 503 when no active district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns database.status "ok" and latencyMs >= 0 when DB healthy', async () => {
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.database.status).toBe('ok')
    expect(res.body.database.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('returns database.status "error" and latencyMs null when DB throws', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'))
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.database.status).toBe('error')
    expect(res.body.database.latencyMs).toBeNull()
  })

  it('returns bot.status "ok" when at least one mahalla is active', async () => {
    mockMahallaFindMany.mockResolvedValue(MAHALLAS) // contains one 'active'
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.bot.status).toBe('ok')
  })

  it('returns bot.status "error" when all mahallas are removed', async () => {
    const removedMahallas = [
      { id: 1, name: 'A', bot_status: 'removed', bot_last_seen_at: null },
      { id: 2, name: 'B', bot_status: 'removed', bot_last_seen_at: null },
    ]
    mockMahallaFindMany.mockResolvedValue(removedMahallas)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.bot.status).toBe('error')
  })

  it('returns bot.status "error" when district has no mahallas', async () => {
    // default: mockMahallaFindMany → []
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.bot.status).toBe('error')
  })

  it('returns botConnectivity with camelCase fields', async () => {
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.botConnectivity).toHaveLength(2)
    expect(res.body.botConnectivity[0]).toMatchObject({
      mahallaId:     1,
      mahallaName:   'Навбаҳор маҳалласи',
      botStatus:     'active',
      botLastSeenAt: MAHALLAS[0].bot_last_seen_at!.toISOString(),
    })
    expect(res.body.botConnectivity[1]).toMatchObject({
      mahallaId:     2,
      mahallaName:   'Олмазор маҳалласи',
      botStatus:     'removed',
      botLastSeenAt: null,
    })
  })

  it('returns scheduler.status "running" when isBatchRunning() is true', async () => {
    mockIsBatchRunning.mockReturnValue(true)
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.scheduler.status).toBe('running')
    expect(res.body.scheduler.nextRunInSeconds).toBeNull()
  })

  it('returns aiApi.status "unknown" and lastCheckedAt null', async () => {
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(res.body.aiApi).toEqual({ status: 'unknown', lastCheckedAt: null })
  })

  it('returns correct top-level shape with all expected keys', async () => {
    mockMahallaFindMany.mockResolvedValue(MAHALLAS)
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(200)
    expect(Object.keys(res.body).sort()).toEqual([
      'aiApi', 'bot', 'botConnectivity', 'database', 'scheduler',
    ])
  })

  it('returns 500 on unexpected Prisma error in mahalla query', async () => {
    mockMahallaFindMany.mockRejectedValue(new Error('DB gone'))
    const res = await request(app).get('/api/ops/system-health')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'System health query failed',
    })
  })
})
