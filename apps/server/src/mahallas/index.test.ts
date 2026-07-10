// apps/server/src/mahallas/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'

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

// Mock DB
const mockUserFindUnique = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}))

const mockQueryMahallasForDistrict = vi.hoisted(() => vi.fn())
const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('./query.js', () => ({
  queryMahallasForDistrict: mockQueryMahallasForDistrict,
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}))

import { mahallasRouter } from './index.js'
import { requireAuth } from '../auth/middleware.js'

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
    req.session.userId = 1
    req.session.districtId = req.body.districtId as number
    res.json({ ok: true })
  })

  app.use('/api', requireAuth)
  app.use('/api', mahallasRouter)

  return app
}

describe('mahallasRouter', () => {
  let sessionDistrictId = 42

  beforeEach(() => {
    vi.clearAllMocks()
    sessionDistrictId = 42
    mockUserFindUnique.mockImplementation(async () => {
      return {
        id: 1,
        district_id: sessionDistrictId,
        is_active: true,
      }
    })
  })

  it('rejects unauthenticated requests with 401', async () => {
    const app = createTestApp()
    const response = await request(app).get('/api/mahallas')
    expect(response.status).toBe(401)
  })

  it('queries mahallas using the district ID from the session', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    sessionDistrictId = 42
    await agent.post('/test/login').send({ districtId: 42 })

    const mockData = [
      { id: 1, district_id: 42, name: 'Mahalla 1' },
      { id: 2, district_id: 42, name: 'Mahalla 2' },
    ]
    mockQueryMahallasForDistrict.mockResolvedValue(mockData)

    const response = await agent.get('/api/mahallas')
    expect(response.status).toBe(200)
    expect(mockQueryMahallasForDistrict).toHaveBeenCalledWith(42)
    expect(response.body).toEqual([
      { id: 1, districtId: 42, name: 'Mahalla 1' },
      { id: 2, districtId: 42, name: 'Mahalla 2' },
    ])
  })

  it('ignores any injected district ID query param or body', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    sessionDistrictId = 42
    await agent.post('/test/login').send({ districtId: 42 })
    mockQueryMahallasForDistrict.mockResolvedValue([])

    const response = await agent
      .get('/api/mahallas?districtId=99')
      .send({ districtId: 99 })

    expect(response.status).toBe(200)
    expect(mockQueryMahallasForDistrict).toHaveBeenCalledWith(42)
  })

  it('returns 500 when query fails', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    sessionDistrictId = 42
    await agent.post('/test/login').send({ districtId: 42 })
    mockQueryMahallasForDistrict.mockRejectedValue(new Error('DB connection lost'))

    const response = await agent.get('/api/mahallas')
    expect(response.status).toBe(500)
    expect(response.body).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Failed to load mahallas',
    })
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
