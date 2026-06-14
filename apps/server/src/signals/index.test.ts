// apps/server/src/signals/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'

// ─── vi.hoisted mocks (must be declared before vi.mock factories) ─────────────

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

// Mock prisma (needed by query.ts import chain)
vi.mock('../shared/db.js', () => ({
  prisma: {
    signalMessage: {
      findMany: vi.fn(),
    },
  },
}))

// Mocks for query, mapper, logger — hoisted so factory closures can reference them
const mockQuerySignals       = vi.hoisted(() => vi.fn())
const mockGetTodayUTC5Range  = vi.hoisted(() => vi.fn())
const mockMapSignalRow       = vi.hoisted(() => vi.fn())
const mockLoggerError        = vi.hoisted(() => vi.fn())

vi.mock('./query.js', () => ({
  querySignals:      mockQuerySignals,
  getTodayUTC5Range: mockGetTodayUTC5Range,
}))

vi.mock('./mapper.js', () => ({
  mapSignalRow: mockMapSignalRow,
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}))

// Import after all vi.mock() calls
import { signalsRouter } from './index.js'
import { requireAuth }   from '../auth/middleware.js'

// ─── Test app factory ─────────────────────────────────────────────────────────

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  }))

  // Helper route to set session (simulates successful login)
  app.post('/test/login', (req, res) => {
    req.session.userId     = req.body.userId     as number
    req.session.districtId = req.body.districtId as number
    res.json({ ok: true })
  })

  // Wire requireAuth BEFORE signalsRouter — mirrors production web/index.ts ordering
  app.use('/api', requireAuth)
  app.use('/api', signalsRouter)

  return app
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const SESSION_DISTRICT_ID = 7

const MOCK_RANGE = {
  from: new Date('2026-06-13T19:00:00.000Z'),
  to:   new Date('2026-06-14T10:30:00.000Z'),
}

const MOCK_SIGNAL = {
  id:                   1,
  telegramUpdateId:     100,
  telegramMessageId:    200,
  telegramMessageUrl:   'https://t.me/c/9876543210/200',
  districtId:           SESSION_DISTRICT_ID,
  mahallaId:            2,
  mahallaName:          'Navbahor',
  senderDisplayName:    'Alisher',
  senderUsername:       'alisher',
  telegramTimestamp:    '2026-06-14T10:00:00.000Z',
  rawText:              "Gaz yo'q",
  textSource:           'text',
  category:             'gas',
  hokimRelated:         false,
  keywordMatched:       true,
  matchedKeyword:       'gaz',
  shortLabel:           null,
  classifiedAt:         '2026-06-14T10:20:00.000Z',
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/signals', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()

    // Default: getTodayUTC5Range returns MOCK_RANGE
    mockGetTodayUTC5Range.mockReturnValue(MOCK_RANGE)
    // Default: querySignals resolves to single raw row placeholder
    mockQuerySignals.mockResolvedValue([{}])
    // Default: mapSignalRow returns MOCK_SIGNAL
    mockMapSignalRow.mockReturnValue(MOCK_SIGNAL)
  })

  // ── Authentication ──────────────────────────────────────────────────────────

  it('returns 401 for unauthenticated requests (requireAuth gate)', async () => {
    const res = await request(app).get('/api/signals')
    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ statusCode: 401, error: 'Unauthorized' })
  })

  // ── Default range (no params) ───────────────────────────────────────────────

  it('calls getTodayUTC5Range and querySignals with session districtId when no params', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals')

    expect(res.status).toBe(200)
    expect(mockGetTodayUTC5Range).toHaveBeenCalledOnce()
    expect(mockQuerySignals).toHaveBeenCalledWith(SESSION_DISTRICT_ID, MOCK_RANGE.from, MOCK_RANGE.to)
    expect(res.body).toEqual([MOCK_SIGNAL])
  })

  // ── Explicit from/to range ──────────────────────────────────────────────────

  it('passes parsed from and to to querySignals when both params are provided', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const from = '2026-06-13T19:00:00Z'
    const to   = '2026-06-14T18:59:59Z'

    const res = await agent.get(`/api/signals?from=${from}&to=${to}`)

    expect(res.status).toBe(200)
    expect(mockGetTodayUTC5Range).not.toHaveBeenCalled()
    expect(mockQuerySignals).toHaveBeenCalledWith(
      SESSION_DISTRICT_ID,
      new Date(from),
      new Date(to),
    )
  })

  // ── District scoping ────────────────────────────────────────────────────────

  it('ignores districtId in query params; uses only req.session.districtId', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?districtId=999')

    expect(res.status).toBe(200)
    // querySignals must be called with the session districtId, not the injected value
    expect(mockQuerySignals).toHaveBeenCalledWith(SESSION_DISTRICT_ID, expect.any(Date), expect.any(Date))
  })

  it('ignores districtId in request body; uses only req.session.districtId', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals').send({ districtId: 999 })

    expect(mockQuerySignals).toHaveBeenCalledWith(SESSION_DISTRICT_ID, expect.any(Date), expect.any(Date))
    expect(res.status).toBe(200)
  })

  // ── 400 — missing pair ──────────────────────────────────────────────────────

  it('returns 400 when only from is provided', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?from=2026-06-13T19:00:00Z')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' })
    expect(res.body.message).toContain('Both from and to')
  })

  it('returns 400 when only to is provided', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?to=2026-06-14T18:59:59Z')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ statusCode: 400, error: 'Bad Request' })
  })

  // ── 400 — invalid date format ───────────────────────────────────────────────

  it('returns 400 when from param is not a valid ISO 8601 with timezone', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?from=not-a-date&to=2026-06-14T18:59:59Z')

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid date format')
  })

  it('returns 400 when to param is an invalid date string', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?from=2026-06-13T19:00:00Z&to=garbage')

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid date format')
  })

  it('returns 400 when from param lacks an explicit timezone (no Z or offset)', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals?from=2026-06-13T19:00:00&to=2026-06-14T18:59:59Z')

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('Invalid date format')
  })

  it('returns 400 when from param is an array (repeated query param)', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    // Supertest encodes ?from[]=... but simulating repeated key:
    const res = await agent.get(
      '/api/signals?from=2026-06-13T19:00:00Z&from=2026-06-13T20:00:00Z&to=2026-06-14T18:59:59Z',
    )

    // Express parses repeated keys as an array; parseDateQueryParam returns null for non-string
    expect(res.status).toBe(400)
  })

  it('returns 400 when from or to params are object-shaped query params', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get(
      '/api/signals?from[value]=2026-06-13T19:00:00Z&to[value]=2026-06-14T18:59:59Z',
    )

    // Express extended query parser parses bracket syntax as objects; only single strings are valid.
    expect(res.status).toBe(400)
  })

  // ── 400 — from > to ─────────────────────────────────────────────────────────

  it('returns 400 when from is after to', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get(
      '/api/signals?from=2026-06-14T18:59:59Z&to=2026-06-13T19:00:00Z',
    )

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('from must be before or equal to to')
  })

  // ── 500 — querySignals failure ───────────────────────────────────────────────

  it('returns 500 and logs when querySignals rejects', async () => {
    const dbError = new Error('DB connection refused')
    mockQuerySignals.mockRejectedValueOnce(dbError)

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
      message:    'Failed to load signals',
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: dbError, districtId: SESSION_DISTRICT_ID },
      'Signals query failed',
    )
  })

  it('returns 500 and logs when mapSignalRow throws (corrupt DB data)', async () => {
    const mapError = new Error('Invalid signal category: road')
    mockMapSignalRow.mockImplementationOnce(() => { throw mapError })

    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({
      statusCode: 500,
      error:      'Internal Server Error',
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      { err: mapError, districtId: SESSION_DISTRICT_ID },
      'Signals query failed',
    )
  })

  // ── Response shape ───────────────────────────────────────────────────────────

  it('returns an unwrapped Signal[] array (not wrapped in data or signals key)', async () => {
    const agent = request.agent(app)
    await agent.post('/test/login').send({ userId: 1, districtId: SESSION_DISTRICT_ID })

    const res = await agent.get('/api/signals')

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)
    // Must not be wrapped
    expect(res.body.data).toBeUndefined()
    expect(res.body.signals).toBeUndefined()
  })
})
