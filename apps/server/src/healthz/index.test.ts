// apps/server/src/healthz/index.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

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

const mockQueryRawUnsafe = vi.hoisted(() => vi.fn())
const mockLoggerError = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    $queryRawUnsafe: mockQueryRawUnsafe,
  },
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    info:  vi.fn(),
    warn:  vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}))

import { healthzRouter } from './index.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use(healthzRouter)
  return app
}

describe('healthzRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('GET /healthz returns 200 without auth', async () => {
    const app = createTestApp()
    const response = await request(app).get('/healthz')
    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
  })

  it('GET /readyz returns 200 when database query succeeds', async () => {
    mockQueryRawUnsafe.mockResolvedValue([{ '?column?': 1 }])
    const app = createTestApp()
    const response = await request(app).get('/readyz')
    expect(response.status).toBe(200)
    expect(mockQueryRawUnsafe).toHaveBeenCalledWith('SELECT 1')
    expect(response.body).toEqual({
      status: 'ok',
      database: 'ok',
    })
  })

  it('GET /readyz returns 503 when database query fails', async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error('Connection failed'))
    const app = createTestApp()
    const response = await request(app).get('/readyz')
    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      status: 'error',
      database: 'error',
    })
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
