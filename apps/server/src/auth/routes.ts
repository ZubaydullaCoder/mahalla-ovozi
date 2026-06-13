import { Router, type IRouter } from 'express'
import * as argon2 from 'argon2'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

// Rate limit: block the 6th attempt after 5 failed attempts per username per 60-second window
const failedLoginAttempts = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX = 5
const RATE_WINDOW_MS = 60 * 1000
let lastPruneAt = 0

function pruneExpiredLoginAttempts(now: number): void {
  if (now - lastPruneAt < RATE_WINDOW_MS) {
    return
  }

  for (const [username, entry] of failedLoginAttempts) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      failedLoginAttempts.delete(username)
    }
  }

  lastPruneAt = now
}

function isRateLimited(username: string): boolean {
  const now = Date.now()
  const entry = failedLoginAttempts.get(username)

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    return false
  }

  return entry.count >= RATE_LIMIT_MAX
}

function recordFailedLogin(username: string): void {
  const now = Date.now()
  const entry = failedLoginAttempts.get(username)

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    failedLoginAttempts.set(username, { count: 1, windowStart: now })
    return
  }

  entry.count++
}

function clearFailedLogins(username: string): void {
  failedLoginAttempts.delete(username)
}

const router: IRouter = Router()

router.post('/login', async (req, res) => {
  const now = Date.now()
  pruneExpiredLoginAttempts(now)

  try {
    const { username, password } = req.body as { username?: unknown; password?: unknown }

    if (typeof username !== 'string' || typeof password !== 'string') {
      res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'username and password are required' })
      return
    }

    if (isRateLimited(username)) {
      res.status(429).json({ statusCode: 429, error: 'Too Many Requests', message: 'Too many login attempts' })
      return
    }

    const user = await prisma.user.findUnique({ where: { username } })

    // CRITICAL: Use same response for unknown user and wrong password — no field discrimination
    if (!user || !user.is_active) {
      recordFailedLogin(username)
      logger.warn({ username }, 'Login failed: user not found or inactive')
      res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
      return
    }

    const valid = await argon2.verify(user.password_hash, password)
    if (!valid) {
      recordFailedLogin(username)
      logger.warn({ username }, 'Login failed: wrong password')
      res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
      return
    }

    clearFailedLogins(username)

    // Successful login — set session
    req.session.userId = user.id
    req.session.districtId = user.district_id

    logger.info({ userId: user.id, districtId: user.district_id }, 'User logged in')
    res.status(200).json({ ok: true })
  } catch (err) {
    logger.error({ err }, 'Unhandled error during login')
    res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Login failed' })
  }
})

router.post('/logout', (req, res) => {
  const sessionName = 'connect.sid' // default express-session cookie name
  const clearCookieOptions = {
    path: '/',
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: false,
  }

  req.session.destroy((err) => {
    if (err) {
      logger.error({ err }, 'Session destroy failed during logout')
      res.status(500).json({ statusCode: 500, error: 'Internal Server Error', message: 'Logout failed' })
      return
    }

    res.clearCookie(sessionName, clearCookieOptions)
    res.status(200).json({ ok: true })
  })
})

export default router
