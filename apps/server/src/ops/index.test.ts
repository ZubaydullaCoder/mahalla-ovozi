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
const mockRunClassifyBatchWithLock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
vi.mock('../classifier/index.js', () => ({
  isBatchRunning:           mockIsBatchRunning,
  runClassifyBatchWithLock: mockRunClassifyBatchWithLock,
  purgeOldSignals:          vi.fn(),
}))

// Prisma mock
const mockDistrictFindFirst    = vi.hoisted(() => vi.fn())
const mockBatchHealthFindFirst = vi.hoisted(() => vi.fn())
const mockBatchHealthFindMany  = vi.hoisted(() => vi.fn())
const mockRawMessageCount      = vi.hoisted(() => vi.fn())
const mockMahallaFindMany      = vi.hoisted(() => vi.fn())
const mockQueryRaw             = vi.hoisted(() => vi.fn())
const mockPipelineEventFindMany = vi.hoisted(() => vi.fn())
const mockKeywordFindMany  = vi.hoisted(() => vi.fn())
const mockKeywordFindFirst = vi.hoisted(() => vi.fn())
const mockKeywordCreate    = vi.hoisted(() => vi.fn())
const mockKeywordUpdateMany = vi.hoisted(() => vi.fn())
const mockKeywordDeleteMany = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    district:      { findFirst: mockDistrictFindFirst },
    batchHealth:   { findFirst: mockBatchHealthFindFirst, findMany: mockBatchHealthFindMany },
    rawMessage:    { count: mockRawMessageCount },
    mahalla:       { findMany: mockMahallaFindMany },
    pipelineEvent: { findMany: mockPipelineEventFindMany },
    keyword: {
      findMany:  mockKeywordFindMany,
      findFirst: mockKeywordFindFirst,
      create:    mockKeywordCreate,
      updateMany: mockKeywordUpdateMany,
      deleteMany: mockKeywordDeleteMany,
    },
    $queryRaw:     mockQueryRaw,
  },
}))

// Simulator mock — isolates route tests from the real pipeline
const mockSimulateWebhook        = vi.hoisted(() => vi.fn())
const mockInjectSimulatedMessage = vi.hoisted(() => vi.fn())
vi.mock('./simulator.js', () => ({
  simulateWebhook:         mockSimulateWebhook,
  injectSimulatedMessage:  mockInjectSimulatedMessage,
}))

// Logger mock
vi.mock('../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { opsRouter } from './index.js'
import { Prisma } from '../generated/prisma/client.js'

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
  // Simulator defaults
  mockSimulateWebhook.mockResolvedValue({
    decision: 'queued', filterMode: 'keyword_gate', keywordMatched: true, matchedPhrase: 'suv'
  })
  mockInjectSimulatedMessage.mockResolvedValue(42)
  // Pipeline event defaults
  mockPipelineEventFindMany.mockResolvedValue([])
  mockRunClassifyBatchWithLock.mockResolvedValue(undefined)
  // Keyword defaults
  mockKeywordFindMany.mockResolvedValue([])
  mockKeywordFindFirst.mockResolvedValue(null)
  mockKeywordCreate.mockResolvedValue({
    id: 1, district_id: 1, phrase: 'suv', is_active: true,
    created_at: new Date('2026-06-22T08:00:00.000Z'),
    updated_at: new Date('2026-06-22T08:00:00.000Z'),
  })
  mockKeywordUpdateMany.mockResolvedValue({ count: 1 })
  mockKeywordDeleteMany.mockResolvedValue({ count: 1 })
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

// ─── GET /api/ops/mahallas ────────────────────────────────────────────────────

describe('GET /api/ops/mahallas', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).get('/api/ops/mahallas')
    expect(res.status).toBe(404)
  })

  it('returns 503 when no active district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/ops/mahallas')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns mahalla list for active district', async () => {
    mockMahallaFindMany.mockResolvedValue([
      { id: 1, name: 'Навбаҳор маҳалласи' },
      { id: 2, name: 'Олмазор маҳалласи' },
    ])
    const res = await request(app).get('/api/ops/mahallas')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({ id: 1, name: 'Навбаҳор маҳалласи' })
  })

  it('returns empty array when district has no mahallas', async () => {
    // default: mockMahallaFindMany → []
    const res = await request(app).get('/api/ops/mahallas')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 500 on Prisma error', async () => {
    mockMahallaFindMany.mockRejectedValue(new Error('DB error'))
    const res = await request(app).get('/api/ops/mahallas')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ error: 'Internal Server Error' })
  })
})

// ─── POST /api/ops/simulate-webhook ──────────────────────────────────────────

describe('POST /api/ops/simulate-webhook', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when mahallaId is missing', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ text: 'Test' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad Request' })
  })

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad Request' })
  })

  it('returns 400 when text is empty string', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1, text: '' })
    expect(res.status).toBe(400)
  })

  it('returns 200 with decision object on success', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1, text: "Suv yo'q" })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      decision:       'queued',
      filterMode:     'keyword_gate',
      keywordMatched: true,
      matchedPhrase:  'suv',
    })
    expect(mockSimulateWebhook).toHaveBeenCalledOnce()
    expect(mockSimulateWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 1, text: "Suv yo'q" })
    )
  })

  it('returns 503 when simulator throws "No active district"', async () => {
    mockSimulateWebhook.mockRejectedValue(new Error('No active district'))
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns 404 when simulator throws "Mahalla not found in active district"', async () => {
    mockSimulateWebhook.mockRejectedValue(new Error('Mahalla not found in active district'))
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 99, text: 'Test' })
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Mahalla not found' })
  })

  it('returns 500 on unexpected simulator error', async () => {
    mockSimulateWebhook.mockRejectedValue(new Error('Unexpected failure'))
    const res = await request(app)
      .post('/api/ops/simulate-webhook')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
    })
  })
})

// ─── POST /api/ops/simulate-message ──────────────────────────────────────────

describe('POST /api/ops/simulate-message', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(404)
  })

  it('returns 400 when mahallaId is missing', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ text: 'Test' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad Request' })
  })

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 1 })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad Request' })
  })

  it('returns 200 with rawMessageId on success', async () => {
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 1, text: "Elektr o'chdi" })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ rawMessageId: 42 })
    expect(mockInjectSimulatedMessage).toHaveBeenCalledOnce()
    expect(mockInjectSimulatedMessage).toHaveBeenCalledWith(
      expect.objectContaining({ mahallaId: 1, text: "Elektr o'chdi" })
    )
  })

  it('returns 503 when simulator throws "No active district"', async () => {
    mockInjectSimulatedMessage.mockRejectedValue(new Error('No active district'))
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns 404 when simulator throws "Mahalla not found in active district"', async () => {
    mockInjectSimulatedMessage.mockRejectedValue(new Error('Mahalla not found in active district'))
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 99, text: 'Test' })
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Mahalla not found' })
  })

  it('returns 500 on unexpected simulator error', async () => {
    mockInjectSimulatedMessage.mockRejectedValue(new Error('Unexpected failure'))
    const res = await request(app)
      .post('/api/ops/simulate-message')
      .send({ mahallaId: 1, text: 'Test' })
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
    })
  })
})

// ─── GET /api/ops/pipeline-events ────────────────────────────────────────────

const PIPELINE_EVENTS = [
  {
    id:               1,
    event_type:       'prefilter_pass',
    district_id:      1,
    mahalla_id:       2,
    telegram_update_id: 101,
    raw_message_id:   10,
    signal_id:        null,
    detail:           { text: 'Suv yo\'q' },
    created_at:       new Date('2026-06-22T10:00:00.000Z'),
  },
  {
    id:               2,
    event_type:       'keyword_match',
    district_id:      1,
    mahalla_id:       null,
    telegram_update_id: 102,
    raw_message_id:   11,
    signal_id:        5,
    detail:           {},
    created_at:       new Date('2026-06-22T09:55:00.000Z'),
  },
]

describe('GET /api/ops/pipeline-events', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).get('/api/ops/pipeline-events')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Not found' })
  })

  it('returns 503 when no active district found', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/ops/pipeline-events')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns empty array when no pipeline events exist', async () => {
    // default: mockPipelineEventFindMany → []
    const res = await request(app).get('/api/ops/pipeline-events')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns events with camelCase fields, newest-first', async () => {
    mockPipelineEventFindMany.mockResolvedValue(PIPELINE_EVENTS)
    const res = await request(app).get('/api/ops/pipeline-events')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({
      id:               1,
      eventType:        'prefilter_pass',
      districtId:       1,
      mahallaId:        2,
      telegramUpdateId: 101,
      rawMessageId:     10,
      signalId:         null,
      createdAt:        '2026-06-22T10:00:00.000Z',
    })
    expect(res.body[1]).toMatchObject({
      id:               2,
      eventType:        'keyword_match',
      mahallaId:        null,
      signalId:         5,
    })
  })

  it('queries Prisma with district_id and orderBy created_at desc', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { district_id: ACTIVE_DISTRICT.id },
        orderBy: { created_at: 'desc' },
      })
    )
  })

  it('uses default limit of 100 when no limit param', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('uses valid limit from query string', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events?limit=50')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    )
  })

  it('clamps limit to 1 when limit=0', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events?limit=0')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    )
  })

  it('clamps limit to 1 when limit is negative', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events?limit=-10')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 1 })
    )
  })

  it('clamps limit to 500 when limit exceeds max', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events?limit=9999')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    )
  })

  it('uses default limit when limit is non-numeric', async () => {
    mockPipelineEventFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/pipeline-events?limit=abc')
    expect(mockPipelineEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 })
    )
  })

  it('returns 500 on Prisma error', async () => {
    mockPipelineEventFindMany.mockRejectedValue(new Error('DB failure'))
    const res = await request(app).get('/api/ops/pipeline-events')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Pipeline events query failed',
    })
  })
})

// ─── POST /api/ops/trigger-batch ─────────────────────────────────────────────

describe('POST /api/ops/trigger-batch', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when OPS_ENABLED is not "true"', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).post('/api/ops/trigger-batch')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ error: 'Not found' })
  })

  it('returns { triggered: true } when isBatchRunning() is false', async () => {
    // defaults: isBatchRunning → false
    const res = await request(app).post('/api/ops/trigger-batch')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ triggered: true })
    expect(mockRunClassifyBatchWithLock).toHaveBeenCalledWith('manual')
  })

  it('returns { status: "locked" } when isBatchRunning() is true', async () => {
    mockIsBatchRunning.mockReturnValue(true)
    const res = await request(app).post('/api/ops/trigger-batch')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'locked' })
    expect(mockRunClassifyBatchWithLock).not.toHaveBeenCalled()
  })

  it('does not await the batch — returns immediately', async () => {
    // Make runClassifyBatchWithLock take a very long time (never resolves in test)
    mockRunClassifyBatchWithLock.mockReturnValue(new Promise(() => { /* never resolves */ }))
    const start = Date.now()
    const res   = await request(app).post('/api/ops/trigger-batch')
    const elapsed = Date.now() - start
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ triggered: true })
    // Should return in well under 100ms because it's fire-and-forget
    expect(elapsed).toBeLessThan(500)
  })
})

// ─── GET /api/ops/filtering-mode ──────────────────────────────────────────────

describe('GET /api/ops/filtering-mode', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns filterMode from env', async () => {
    mockEnv.FILTER_MODE = 'keyword_gate' as typeof mockEnv.FILTER_MODE
    const res = await request(app).get('/api/ops/filtering-mode')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ filterMode: 'keyword_gate' })
  })

  it('returns 404 when ops disabled', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).get('/api/ops/filtering-mode')
    expect(res.status).toBe(404)
  })
})

// ─── GET /api/ops/keywords ────────────────────────────────────────────────────

const KEYWORD_ROWS = [
  {
    id: 1, district_id: 1, phrase: 'suv', is_active: true,
    created_at: new Date('2026-06-22T08:00:00.000Z'),
    updated_at: new Date('2026-06-22T08:00:00.000Z'),
  },
  {
    id: 2, district_id: 1, phrase: 'gaz muammo', is_active: false,
    created_at: new Date('2026-06-22T09:00:00.000Z'),
    updated_at: new Date('2026-06-22T09:30:00.000Z'),
  },
]

describe('GET /api/ops/keywords', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when ops disabled', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).get('/api/ops/keywords')
    expect(res.status).toBe(404)
  })

  it('returns 503 when no active district', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).get('/api/ops/keywords')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ error: 'No active district' })
  })

  it('returns keyword list with camelCase fields sorted active-first', async () => {
    mockKeywordFindMany.mockResolvedValue(KEYWORD_ROWS)
    const res = await request(app).get('/api/ops/keywords')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
    expect(res.body[0]).toMatchObject({
      id: 1, phrase: 'suv', isActive: true,
      createdAt: '2026-06-22T08:00:00.000Z',
      updatedAt: '2026-06-22T08:00:00.000Z',
    })
    expect(res.body[1]).toMatchObject({
      id: 2, phrase: 'gaz muammo', isActive: false,
    })
  })

  it('queries with district_id and correct orderBy', async () => {
    mockKeywordFindMany.mockResolvedValue([])
    await request(app).get('/api/ops/keywords')
    expect(mockKeywordFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where:   { district_id: ACTIVE_DISTRICT.id },
        orderBy: [{ is_active: 'desc' }, { phrase: 'asc' }],
      })
    )
  })

  it('returns empty array when no keywords exist', async () => {
    // default: mockKeywordFindMany → []
    const res = await request(app).get('/api/ops/keywords')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([])
  })

  it('returns 500 on Prisma error', async () => {
    mockKeywordFindMany.mockRejectedValue(new Error('DB failure'))
    const res = await request(app).get('/api/ops/keywords')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Keywords query failed',
    })
  })
})

// ─── POST /api/ops/keywords ───────────────────────────────────────────────────

describe('POST /api/ops/keywords', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
  })

  it('returns 404 when ops disabled', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(404)
  })

  it('creates keyword with 201 and correct shape', async () => {
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({
      id:       1,
      phrase:   'suv',
      isActive: true,
    })
    expect(res.body.createdAt).toBeDefined()
    expect(res.body.updatedAt).toBeDefined()
    expect(mockKeywordCreate).toHaveBeenCalledWith({
      data: { district_id: ACTIVE_DISTRICT.id, phrase: 'suv', is_active: true },
    })
  })

  it('trims and collapses whitespace in phrase', async () => {
    await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: '  suv   muammo  ' })
    expect(mockKeywordCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ phrase: 'suv muammo' }),
    })
  })

  it('returns 400 when phrase is empty', async () => {
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: '' })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ error: 'Bad Request', message: 'Invalid phrase' })
    expect(mockKeywordCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when phrase is only whitespace', async () => {
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: '   ' })
    expect(res.status).toBe(400)
    expect(mockKeywordCreate).not.toHaveBeenCalled()
  })

  it('returns 400 when phrase exceeds 120 characters', async () => {
    const longPhrase = 'a'.repeat(121)
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: longPhrase })
    expect(res.status).toBe(400)
    expect(mockKeywordCreate).not.toHaveBeenCalled()
  })

  it('returns 409 when phrase already exists (case-insensitive check)', async () => {
    mockKeywordFindFirst.mockResolvedValue({ id: 1, phrase: 'Suv' })
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      statusCode: 409,
      error:      'Conflict',
      message:    'Keyword phrase already exists for this district',
    })
    expect(mockKeywordCreate).not.toHaveBeenCalled()
  })

  it('returns 409 when database unique constraint catches a duplicate create', async () => {
    mockKeywordCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      { code: 'P2002', clientVersion: '7.8.0' },
    ))
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(409)
    expect(res.body).toMatchObject({
      statusCode: 409,
      error:      'Conflict',
      message:    'Keyword phrase already exists for this district',
    })
  })

  it('returns 503 when no active district', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(503)
  })

  it('returns 500 on Prisma error', async () => {
    mockKeywordCreate.mockRejectedValue(new Error('DB failure'))
    const res = await request(app)
      .post('/api/ops/keywords')
      .send({ phrase: 'suv' })
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ message: 'Keyword create failed' })
  })
})

// ─── PATCH /api/ops/keywords/:id ──────────────────────────────────────────────

describe('PATCH /api/ops/keywords/:id', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
    // By default, keyword exists in active district
    mockKeywordFindFirst.mockResolvedValue(KEYWORD_ROWS[0])
  })

  it('returns 404 when ops disabled', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({ isActive: false })
    expect(res.status).toBe(404)
  })

  it('toggles isActive and returns updated keyword', async () => {
    mockKeywordFindFirst.mockResolvedValue({
      ...KEYWORD_ROWS[0],
      is_active: false,
      updated_at: new Date('2026-06-22T08:01:00.000Z'),
    })
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({ isActive: false })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ id: 1, isActive: false })
    expect(mockKeywordUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, district_id: ACTIVE_DISTRICT.id },
      data:  { is_active: false },
    })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const res = await request(app)
      .patch('/api/ops/keywords/abc')
      .send({ isActive: false })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ message: 'Invalid keyword id' })
  })

  it('returns 400 when body is missing isActive', async () => {
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({})
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ message: 'PATCH body must only include boolean isActive' })
  })

  it('returns 400 when body has extra fields (strict)', async () => {
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({ isActive: false, phrase: 'hacked' })
    expect(res.status).toBe(400)
  })

  it('returns 404 when keyword belongs to different district', async () => {
    mockKeywordUpdateMany.mockResolvedValue({ count: 0 })
    const res = await request(app)
      .patch('/api/ops/keywords/99')
      .send({ isActive: false })
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ message: 'Keyword not found' })
    expect(mockKeywordFindFirst).not.toHaveBeenCalled()
  })

  it('returns 503 when no active district', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({ isActive: false })
    expect(res.status).toBe(503)
  })

  it('returns 500 on Prisma error', async () => {
    mockKeywordUpdateMany.mockRejectedValue(new Error('DB failure'))
    const res = await request(app)
      .patch('/api/ops/keywords/1')
      .send({ isActive: false })
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ message: 'Keyword update failed' })
  })
})

// ─── DELETE /api/ops/keywords/:id ─────────────────────────────────────────────

describe('DELETE /api/ops/keywords/:id', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    resetMocks()
    app = createTestApp()
    // By default, keyword exists in active district
    mockKeywordFindFirst.mockResolvedValue(KEYWORD_ROWS[0])
  })

  it('returns 404 when ops disabled', async () => {
    mockEnv.OPS_ENABLED = 'false'
    const res = await request(app).delete('/api/ops/keywords/1')
    expect(res.status).toBe(404)
  })

  it('deletes keyword and returns { deleted: 1 }', async () => {
    const res = await request(app).delete('/api/ops/keywords/1')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ deleted: 1 })
    expect(mockKeywordDeleteMany).toHaveBeenCalledWith({
      where: { id: 1, district_id: ACTIVE_DISTRICT.id },
    })
  })

  it('returns 400 when id is not a positive integer', async () => {
    const res = await request(app).delete('/api/ops/keywords/abc')
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ message: 'Invalid keyword id' })
  })

  it('returns 404 when keyword belongs to different district', async () => {
    mockKeywordDeleteMany.mockResolvedValue({ count: 0 })
    const res = await request(app).delete('/api/ops/keywords/99')
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ message: 'Keyword not found' })
  })

  it('returns 503 when no active district', async () => {
    mockDistrictFindFirst.mockResolvedValue(null)
    const res = await request(app).delete('/api/ops/keywords/1')
    expect(res.status).toBe(503)
  })

  it('returns 500 on Prisma error', async () => {
    mockKeywordDeleteMany.mockRejectedValue(new Error('DB failure'))
    const res = await request(app).delete('/api/ops/keywords/1')
    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ message: 'Keyword delete failed' })
  })
})
