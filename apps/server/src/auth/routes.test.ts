import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'

// vi.hoisted() required for mocks used in vi.mock() factories
const mockEnv = vi.hoisted(() => ({
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  NODE_ENV: 'test' as const,
  PORT: 3001,
  BOT_TOKEN: 'test-token',
  TELEGRAM_WEBHOOK_SECRET: 'test-secret',
  FILTER_MODE: 'keyword_gate' as const,
  AI_API_KEY: 'test-key',
  AI_MODEL: 'gemini-2.5-flash',
  SESSION_SECRET: 'test-session-secret',
}))

vi.mock('../shared/env.js', () => ({ env: mockEnv }))

const mockUser = vi.hoisted(() => ({
  id: 1,
  district_id: 1,
  username: 'operator',
  password_hash: 'hash',
  is_active: true,
  created_at: new Date(),
}))

vi.mock('../shared/db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('argon2', () => ({
  verify: vi.fn(),
}))

vi.mock('../shared/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Import mocked modules after vi.mock() calls
import { prisma } from '../shared/db.js'
import * as argon2 from 'argon2'
import { authRouter, requireAuth } from './index.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  // Use MemoryStore in tests — no DB required
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  }))
  app.use('/api/auth', authRouter)
  // Wire requireAuth to test that post-logout requests are properly rejected (AC 2)
  app.use('/api', requireAuth)
  app.get('/api/test-protected', (req, res) => {
    res.json({ districtId: req.session.districtId })
  })
  app.get('/test/session', (req, res) => {
    res.json({ userId: req.session.userId, districtId: req.session.districtId })
  })
  return app
}

describe('POST /api/auth/login', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 200 and Set-Cookie on valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)

    const agent = request.agent(app)
    const res = await agent
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'devpassword' })

    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
    expect(res.body).toEqual({ ok: true })

    const sessionRes = await agent.get('/test/session')
    expect(sessionRes.body).toEqual({ userId: mockUser.id, districtId: mockUser.district_id })
  })

  it('returns 401 on wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(false)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'wrongpw-user', password: 'wrong' })

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Invalid credentials',
    })
  })

  it('returns 401 on unknown username', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'anything' })

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Invalid credentials')
  })

  it('returns 400 when body fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'operator' }) // missing password

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('username and password are required')
  })

  it('returns 429 after 5 failed attempts', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(argon2.verify).mockResolvedValue(false)

    // 5 failed attempts — use a unique username to avoid interference with other tests
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'ratelimited', password: 'x' })
    }

    // 6th attempt should be rate-limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ratelimited', password: 'x' })

    expect(res.status).toBe(429)
    expect(res.body).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Too many login attempts',
    })
  })

  it('resets rate limit counter after 60 seconds', async () => {
    vi.useFakeTimers()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(argon2.verify).mockResolvedValue(false)

    // Exhaust rate limit with a unique username
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'timeuser', password: 'x' })
    }

    // Advance 61 seconds — window should have reset
    vi.advanceTimersByTime(61_000)

    // Should be allowed again — mock success now
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'timeuser', password: 'correct' })

    expect(res.status).toBe(200)
  })
})

describe('POST /api/auth/logout', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()
  })

  it('returns 200 when authenticated user logs out', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)

    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'operator', password: 'devpassword' })

    const res = await agent.post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('clears the session cookie in the logout response', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)

    const agent = request.agent(app)
    await agent.post('/api/auth/login').send({ username: 'operator', password: 'devpassword' })

    const res = await agent.post('/api/auth/logout')
    const setCookie = res.headers['set-cookie'] as string[] | string | undefined
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieStr).toMatch(/connect\.sid/)
    expect(cookieStr.toLowerCase()).toContain('path=/')
    expect(cookieStr.toLowerCase()).toContain('httponly')
    expect(cookieStr.toLowerCase()).toContain('samesite=strict')
    expect(cookieStr.toLowerCase()).toMatch(/expires=thu, 01 jan 1970|max-age=0/)
  })

  it('rejects the original pre-logout cookie after logout with 401', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)

    const agent = request.agent(app)
    const loginRes = await agent.post('/api/auth/login').send({ username: 'operator', password: 'devpassword' })
    const setCookie = loginRes.headers['set-cookie'] as string[] | string | undefined
    const originalCookie = Array.isArray(setCookie) ? setCookie[0] : setCookie

    await agent.post('/api/auth/logout')

    if (!originalCookie) {
      throw new Error('Expected login response to set a session cookie')
    }

    const res = await request(app)
      .get('/api/test-protected')
      .set('Cookie', originalCookie)

    expect(res.status).toBe(401)
  })

  it('returns 200 even when called without an active session (idempotent)', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
  })
})
