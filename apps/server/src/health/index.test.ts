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
const mockUserFindUnique       = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    batchHealth: { findFirst: mockBatchHealthFindFirst },
    rawMessage:  { count:     mockRawMessageCount },
    user:        { findUnique: mockUserFindUnique },
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
    mockUserFindUnique.mockResolvedValue({
      id:          1,
      district_id: SESSION_DISTRICT_ID,
      is_active:   true,
    })
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
