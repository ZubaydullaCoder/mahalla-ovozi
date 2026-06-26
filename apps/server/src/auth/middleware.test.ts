import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import session from 'express-session'

const mockUserFindUnique = vi.hoisted(() => vi.fn())

vi.mock('../shared/db.js', () => ({
  prisma: {
    user: {
      findUnique: mockUserFindUnique,
    },
  },
}))

vi.mock('../shared/logger.js', () => ({
  logger: {
    warn:  vi.fn(),
    error: vi.fn(),
  },
}))

import { requireAuth } from './middleware.js'

function createTestApp() {
  const app = express()
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  }))
  app.use(express.json())

  // Non-/api route must not be affected by app.use('/api', requireAuth).
  app.post('/webhook', (_req, res) => {
    res.json({ ok: true })
  })

  // Auth route registered before requireAuth must remain reachable without a session.
  app.post('/api/auth/login', (_req, res) => {
    res.json({ ok: true })
  })

  // Helper route to establish a session (simulates login)
  app.post('/test/login', (req, res) => {
    req.session.userId = req.body.userId
    if (req.body.districtId !== undefined) {
      req.session.districtId = req.body.districtId
    }
    res.json({ ok: true })
  })

  // Protected route — behind requireAuth
  app.use('/api', requireAuth)
  app.get('/api/test-protected', (req, res) => {
    res.json({
      districtId: req.session.districtId,
      bodyDistrictId: req.body?.districtId ?? null,
      queryDistrictId: req.query.districtId ?? null,
    })
  })
  app.post('/api/test-protected', (req, res) => {
    res.json({
      districtId: req.session.districtId,
      bodyDistrictId: req.body?.districtId ?? null,
      queryDistrictId: req.query.districtId ?? null,
    })
  })

  return app
}

describe('requireAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({
      id:          1,
      district_id: 42,
      is_active:   true,
    })
  })

  it('returns 401 when no session exists', async () => {
    const app = createTestApp()
    const res = await request(app).get('/api/test-protected')

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
  })

  it('allows access with valid session and passes districtId', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(200)
    expect(res.body.districtId).toBe(42)
    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where:  { id: 1 },
      select: { id: true, district_id: true, is_active: true },
    })
  })

  it('returns 401 when session has userId but no districtId', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Authentication required')
  })

  it('returns 401 when the session user no longer exists', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Authentication required')
  })

  it('returns 401 when the session user is inactive', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id:          1,
      district_id: 42,
      is_active:   false,
    })

    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(401)
  })

  it('returns 401 when the session district no longer matches the user', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id:          1,
      district_id: 7,
      is_active:   true,
    })

    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(401)
  })

  it('returns 500 when session validation fails unexpectedly', async () => {
    mockUserFindUnique.mockRejectedValueOnce(new Error('db down'))

    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(500)
    expect(res.body.message).toBe('Authentication check failed')
  })

  it('uses session districtId, ignores districtId from query params', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    // Try to inject districtId via query param
    const res = await agent.get('/api/test-protected?districtId=999')

    expect(res.status).toBe(200)
    expect(res.body.districtId).toBe(42)
    expect(res.body.queryDistrictId).toBe('999')
  })

  it('uses session districtId, ignores districtId from request body', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1, districtId: 42 })

    const res = await agent
      .post('/api/test-protected')
      .send({ districtId: 999 })

    expect(res.status).toBe(200)
    expect(res.body.districtId).toBe(42)
    expect(res.body.bodyDistrictId).toBe(999)
  })

  it('does not guard /api/auth routes registered before requireAuth', async () => {
    const app = createTestApp()

    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })

  it('does not guard webhook routes outside /api', async () => {
    const app = createTestApp()

    const res = await request(app).post('/webhook').send({})

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})
