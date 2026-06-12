# Story 2.1: Login & Session Issuance

Status: done

## Story

As an **authorized user**,
I want to log in with my username and password and receive a secure session cookie,
so that I can access the dashboard and my session persists for up to 8 hours without re-authenticating.

## Acceptance Criteria

1. **Given** a user account exists in the `users` table with an argon2-hashed password for the correct district  
   **When** the user submits valid credentials to `POST /api/auth/login`  
   **Then** the server verifies the password with argon2, creates a PostgreSQL-backed session via `connect-pg-simple`, and responds with HTTP 200 and a `Set-Cookie` header containing an `httpOnly`, `sameSite: strict` session cookie with 8-hour `maxAge`

2. **And** the session stores `userId` and `districtId` (never exposed to client JavaScript)

3. **And** when invalid credentials are submitted, the server returns HTTP 401 with `{ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' }` — no information about which field was wrong

4. **And** after 5 failed login attempts per username within a 60-second window, subsequent attempts return HTTP 429 (rate limit); the counter resets after 60 seconds

5. **And** `pnpm lint` and `pnpm test` pass; unit tests cover: successful login, wrong password, rate limit trigger and reset

## Tasks / Subtasks

- [x] Task 1: Install `express-session`, `connect-pg-simple`, and their type packages (AC: 1)
  - [x] 1.1 `pnpm --filter @mahalla-ovozi/server add express-session connect-pg-simple`
  - [x] 1.2 `pnpm --filter @mahalla-ovozi/server add -D @types/express-session @types/connect-pg-simple`

- [x] Task 2: Add `SESSION_SECRET` to `env.ts` schema (AC: 2)
  - [x] 2.1 Add `SESSION_SECRET: z.string().min(1)` to `EnvSchema` in `apps/server/src/shared/env.ts`

- [x] Task 3: Declare session type augmentation (AC: 2)
  - [x] 3.1 Create `apps/server/src/shared/session.d.ts` to augment `express-session` with `userId: number` and `districtId: number`

- [x] Task 4: Wire session middleware in `web/index.ts` (AC: 1, 2)
  - [x] 4.1 Import `session` from `express-session`, `connectPgSimple` from `connect-pg-simple`, `Pool` from `pg`
  - [x] 4.2 Create `pgPool` with `new Pool({ connectionString: env.DATABASE_URL })`
  - [x] 4.3 Create `PgStore = connectPgSimple(session)` and `app.use(session({...}))` with exact configuration from architecture Section 6
  - [x] 4.4 Mount session middleware **before** `webhookRouter` — session must be available on all routes

- [x] Task 5: Create `apps/server/src/auth/routes.ts` — login route + failed-login rate limiter (AC: 1, 3, 4)
  - [x] 5.1 Implement in-memory failed-login limiter map: `Map<username, { count: number; windowStart: number }>`
  - [x] 5.2 Implement `POST /api/auth/login` handler: validate body, block if the username already has 5 failed attempts in the active window, lookup user, verify argon2 hash, record failed attempts only on invalid credentials, clear the username counter on success, set session, return 200
  - [x] 5.3 Return HTTP 429 on the 6th attempt within a 60-second window after 5 failed attempts: `{ statusCode: 429, error: 'Too Many Requests', message: 'Too many login attempts' }`
  - [x] 5.4 Return HTTP 401 on bad credentials: `{ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' }` — same message for wrong username or wrong password

- [x] Task 6: Create `apps/server/src/auth/index.ts` — export auth router (AC: 1)
  - [x] 6.1 Export default `authRouter` from `routes.ts`

- [x] Task 7: Register auth router in `web/index.ts` (AC: 1)
  - [x] 7.1 Mount `authRouter` under `/api/auth` **after** session middleware and **after** `express.json()` so `req.body` is populated for login

- [x] Task 8: Write tests in `apps/server/src/auth/routes.test.ts` (AC: 5)
  - [x] 8.1 Test: valid credentials → 200 + Set-Cookie header
  - [x] 8.2 Test: wrong password → 401 with exact error shape
  - [x] 8.3 Test: unknown username → 401 (same message as wrong password — no field discrimination)
  - [x] 8.4 Test: after 5 failed attempts, the 6th attempt → 429 rate limit response
  - [x] 8.5 Test: after 60-second window reset, counter clears and login is allowed again

- [x] Task 9: Pre-commit verification (AC: 5)
  - [x] 9.1 `pnpm lint` passes
  - [x] 9.2 `pnpm test` passes (all 86 tests: 80 existing + 6 new auth tests)
  - [x] 9.3 `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` passes

### Review Findings

- [x] [Review][Patch] Login route has no async error boundary [apps/server/src/auth/routes.ts:40]
- [x] [Review][Patch] Failed-login limiter retains expired one-off usernames indefinitely [apps/server/src/auth/routes.ts:7]
- [x] [Review][Patch] Tests do not verify that successful login stores `userId` and `districtId` in the session [apps/server/src/auth/routes.test.ts:73]

## Dev Notes

### Critical Pre-Coding Decision: Package Installation Required

`express-session` and `connect-pg-simple` are **NOT yet installed**. You MUST install them before writing any code:

```bash
pnpm --filter @mahalla-ovozi/server add express-session connect-pg-simple
pnpm --filter @mahalla-ovozi/server add -D @types/express-session @types/connect-pg-simple
```

`argon2` is already installed (`apps/server/package.json` → `dependencies: { "argon2": "^0.43.0" }`). Do NOT re-install it.

`pg` is already installed as a dependency. The `Pool` class from `pg` is available for `connect-pg-simple`. Do NOT install a duplicate `pg`.

---

### Task 2 Deep Dive: `env.ts` Update

`SESSION_SECRET` is present in `.env` but **missing from `EnvSchema`** in `apps/server/src/shared/env.ts`. This is a **blocker** — the server will crash at startup if `SESSION_SECRET` is not validated.

**Current `env.ts`** (16 lines — no `SESSION_SECRET`):
```typescript
import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  DATABASE_URL:            z.string().min(1),
  NODE_ENV:                z.enum(['development', 'production', 'test']).default('development'),
  PORT:                    z.coerce.number().int().positive().default(3001),
  BOT_TOKEN:               z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  FILTER_MODE:             z.enum(['ai_full', 'keyword_gate', 'shadow_compare']).default('keyword_gate'),
  AI_API_KEY:              z.string().min(1),
  AI_MODEL:                z.string().min(1).default('gemini-2.5-flash'),
})

export const env = EnvSchema.parse(process.env)
```

**Required addition** — add one line to `EnvSchema`:
```typescript
SESSION_SECRET: z.string().min(1),
```

Place it logically after `DATABASE_URL` and before `NODE_ENV`.

---

### Task 3 Deep Dive: Session Type Declaration

`express-session` types do not include custom session properties by default. You must extend the module's type:

```typescript
// apps/server/src/shared/session.d.ts
import 'express-session'

declare module 'express-session' {
  interface SessionData {
    userId: number
    districtId: number
  }
}
```

This file is automatically picked up by TypeScript. It enables `req.session.userId` and `req.session.districtId` to be type-safe without a cast. Do NOT use `(req.session as any)`.

---

### Task 4 Deep Dive: Session Middleware Wiring in `web/index.ts`

**Exact session setup from Architecture Section 6:**

```typescript
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import { Pool } from 'pg'

const PgStore = connectPgSimple(session)
const pgPool = new Pool({ connectionString: env.DATABASE_URL })

app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'sessions',
    createTableIfMissing: true   // Phase 1 convenience — creates the sessions table automatically
  }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,              // Phase 1: local HTTP. Phase 2: true behind Nginx
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours in milliseconds
  }
}))
```

**Middleware order in `web/index.ts` — critical:**

```typescript
const app = express()
app.use(morgan('dev'))
app.use(session({ ... }))          // ← FIRST: session must be available on all routes
app.use(express.json())            // ← body parsing after session
app.use(webhookRouter)             // ← webhook (uses session? No — but order is consistent)
app.use('/api/auth', authRouter)   // ← auth routes (uses req.session to set values)
// Later in Epic 2 Story 2.2: requireAuth middleware for protected routes
```

**pgPool vs Prisma:** `connect-pg-simple` requires a native `pg.Pool` — it does NOT use Prisma. This is intentional per AR3. The sessions table is managed by `connect-pg-simple`, not Prisma. The pool connects to the same database (`env.DATABASE_URL`) but is separate from the Prisma adapter pool.

**`createTableIfMissing: true`:** This auto-creates the `sessions` table on first startup. Do NOT manually create this table or add it to `schema.prisma`. It is managed entirely by `connect-pg-simple`.

---

### Task 5 Deep Dive: `auth/routes.ts` Implementation

**Module file:** `apps/server/src/auth/routes.ts`

**In-memory failed-login rate limiter:**

```typescript
// Rate limit: block the 6th attempt after 5 failed attempts per username per 60-second window
const failedLoginAttempts = new Map<string, { count: number; windowStart: number }>()
const RATE_LIMIT_MAX = 5
const RATE_WINDOW_MS = 60 * 1000

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
```

**Login handler:**

```typescript
import { Router } from 'express'
import * as argon2 from 'argon2'
import { prisma } from '../shared/db.js'
import { logger } from '../shared/logger.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: unknown; password?: unknown }

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ statusCode: 400, error: 'Bad Request', message: 'username and password are required' })
  }

  if (isRateLimited(username)) {
    return res.status(429).json({ statusCode: 429, error: 'Too Many Requests', message: 'Too many login attempts' })
  }

  const user = await prisma.user.findUnique({ where: { username } })

  // CRITICAL: Use same response for unknown user and wrong password — no field discrimination
  if (!user || !user.is_active) {
    recordFailedLogin(username)
    logger.warn({ username }, 'Login failed: user not found or inactive')
    return res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
  }

  const valid = await argon2.verify(user.password_hash, password)
  if (!valid) {
    recordFailedLogin(username)
    logger.warn({ username }, 'Login failed: wrong password')
    return res.status(401).json({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' })
  }

  clearFailedLogins(username)

  // Successful login — set session
  req.session.userId = user.id
  req.session.districtId = user.district_id

  logger.info({ userId: user.id, districtId: user.district_id }, 'User logged in')
  return res.status(200).json({ ok: true })
})

export default router
```

**Key rules:**
- `argon2.verify(hash, plain)` — hash first, plain second. Do NOT reverse.
- `is_active` check prevents disabled accounts from logging in.
- Check the failed-login limiter before DB lookup and return 429 when the username already has 5 failed attempts in the active window.
- Increment the failed-login counter only for invalid credentials or inactive users; clear the username's counter on successful login.
- Never expose which field was wrong in the 401 response. Always: `'Invalid credentials'`.
- Log warnings on failed login (structured, no password logged). Log info on success.
- `req.session.save()` is NOT required after setting properties when `saveUninitialized: false` and express-session auto-saves on response — but be aware `req.session.regenerate()` may be used for session fixation prevention in higher-security setups. For Phase 1 this is sufficient.

---

### Task 6 Deep Dive: `auth/index.ts`

Simple barrel re-export:

```typescript
// apps/server/src/auth/index.ts
export { default as authRouter } from './routes.js'
```

---

### Task 7 Deep Dive: Router Mounting in `web/index.ts`

```typescript
import { authRouter } from '../auth/index.js'

// After session middleware and after express.json(), so req.body is available.
// /api/auth routes do NOT need requireAuth middleware — they are the auth endpoints themselves.
app.use('/api/auth', authRouter)
```

Endpoint result: `POST /api/auth/login` → handled by `authRouter` at path `'/login'`.

---

### Task 8 Deep Dive: Testing Guide

**Test file:** `apps/server/src/auth/routes.test.ts`

Use `supertest` (already in devDependencies). Follow the Vitest mock patterns from `pipeline.test.ts` and `batch-processor.test.ts`.

**Key mock setup:**

```typescript
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
```

**Test app factory (use in-memory session store for tests):**

```typescript
import { authRouter } from './routes.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  // Use MemoryStore in tests — no DB required
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 }
  }))
  app.use('/api/auth', authRouter)
  return app
}
```

**Test cases:**

```typescript
describe('POST /api/auth/login', () => {
  let app: ReturnType<typeof createTestApp>

  beforeEach(() => {
    app = createTestApp()
    vi.clearAllMocks()
  })

  it('returns 200 and Set-Cookie on valid credentials', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'devpassword' })

    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 on wrong password', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)
    vi.mocked(argon2.verify).mockResolvedValueOnce(false)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'operator', password: 'wrong' })

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

  it('returns 429 after 5 failed attempts', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(argon2.verify).mockResolvedValue(false)

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'ratelimited', password: 'x' })
    }

    // 6th attempt should be rate-limited
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ratelimited', password: 'x' })

    expect(res.status).toBe(429)
    expect(res.body.statusCode).toBe(429)
  })

  it('resets rate limit counter after 60 seconds', async () => {
    vi.useFakeTimers()
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
    vi.mocked(argon2.verify).mockResolvedValue(false)

    // Exhaust rate limit
    for (let i = 0; i < 5; i++) {
      await request(app).post('/api/auth/login').send({ username: 'timeuser', password: 'x' })
    }

    // Advance 61 seconds
    vi.advanceTimersByTime(61_000)

    // Should be allowed again — mock success now
    vi.mocked(argon2.verify).mockResolvedValueOnce(true)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(mockUser)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'timeuser', password: 'correct' })

    expect(res.status).toBe(200)
    vi.useRealTimers()
  })
})
```

**Note on rate limiter state in tests:** The rate limiter `Map` is module-level state. If tests share the same module import (which they do in Vitest), rate limit counts from one test leak into the next for the same username. Use **distinct usernames per test** to avoid interference (as shown above: `'ratelimited'`, `'timeuser'`, `'nobody'`, `'operator'`).

---

### Anti-Patterns to Prevent

| ❌ Wrong | ✅ Correct |
|---|---|
| `argon2.verify(password, hash)` | `argon2.verify(hash, password)` — hash is first argument |
| `{ message: 'Wrong password' }` | `{ message: 'Invalid credentials' }` — no field discrimination |
| `{ message: 'User not found' }` | `{ message: 'Invalid credentials' }` — same as wrong password |
| `(req.session as any).userId = user.id` | `req.session.userId = user.id` after proper `session.d.ts` declaration |
| Import `connect-pg-simple` as named import | `import connectPgSimple from 'connect-pg-simple'` — default import |
| `new PgStore({ connectionString: ... })` | `new PgStore({ pool: pgPool, ... })` — pass pool not connection string |
| Accept `districtId` from `req.body` | Always from `req.session.districtId` — never from request input |
| Install `pg` again | `pg` is already installed — do NOT create a duplicate |
| Add `sessions` table to `schema.prisma` | `connect-pg-simple` manages this table; keep it out of Prisma schema |

---

### Files to Create / Modify Summary

| File | Action | Why |
|---|---|---|
| `apps/server/src/shared/env.ts` | MODIFY | Add `SESSION_SECRET` to `EnvSchema` |
| `apps/server/src/shared/session.d.ts` | NEW | Session type augmentation for `userId` + `districtId` |
| `apps/server/src/auth/routes.ts` | NEW | Login route + in-memory rate limiter |
| `apps/server/src/auth/index.ts` | NEW | Barrel export of `authRouter` |
| `apps/server/src/auth/routes.test.ts` | NEW | Vitest tests for login route |
| `apps/server/src/web/index.ts` | MODIFY | Wire session middleware + mount auth router |
| `apps/server/package.json` | MODIFY | Add `express-session` and `connect-pg-simple` deps (via pnpm install) |

**Do NOT touch:** `schema.prisma` (no `sessions` model), `db.ts` (no Prisma session involvement), `classifier/`, `bot/`, `keywords/` modules.

---

### Project Structure Notes

- New `auth/` module follows module boundary rule (AR15): `auth/` writes to `users` (session data only), reads `users`. Does NOT access `signal_messages`, `raw_messages`, `mahallas`, etc.
- `session.d.ts` placed in `shared/` because it augments global express-session types used across all modules.
- `auth/index.ts` is the public barrel — `web/index.ts` imports only from `'../auth/index.js'`.
- `.js` extension required on all imports (NodeNext module resolution established in Epic 1 stories).

### Cross-Epic Context (Epic 1 Learnings)

- All imports use `.js` extension (TypeScript NodeNext resolution). e.g. `import { prisma } from '../shared/db.js'`
- `vi.hoisted()` is required for mock values used inside `vi.mock()` factory functions.
- `vi.setSystemTime()` / `vi.useFakeTimers()` for time-dependent tests.
- `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` — scope TypeScript check to server. Root `pnpm exec tsc --noEmit` is also acceptable.
- `pnpm test` runs ALL Vitest tests project-wide — ensure 80 existing tests + new tests all pass.
- Docker PostgreSQL must be running for Prisma to resolve client — but for **this story** all DB interaction is mocked in unit tests, so no running DB is needed for test pass.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 6: Authentication & Security]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 13: Implementation Patterns (district scope rule)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 14: Module Boundaries (auth/ boundary)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.1]
- [Source: `apps/server/src/shared/env.ts` — current EnvSchema (SESSION_SECRET missing)]
- [Source: `apps/server/src/web/index.ts` — current server entry (no session wiring yet)]
- [Source: `apps/server/package.json` — confirmed: express-session + connect-pg-simple NOT installed; argon2 + pg already present]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 12 (AR3): connect-pg-simple uses separate pg.Pool, not Prisma client]
- [Source: `_bmad-output/implementation-artifacts/1-6-signal-retention-purge.md` — Dev notes: vi.hoisted(), .js imports, pnpm exec tsc scope]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking) via Antigravity

### Debug Log References

- Fixed: `authRouter` import in test file must use `./index.js` barrel (default export not re-exported as named from `routes.ts` directly).
- Fixed: TS2742 non-portable inferred type on `router` — resolved by importing `IRouter` and annotating `const router: IRouter = Router()`.

### Completion Notes List

- Installed `express-session@^1.18.1` and `connect-pg-simple` with their `@types` packages.
- Added `SESSION_SECRET` to `EnvSchema` in `env.ts` (it was already in `.env` but missing from schema validation).
- Created `session.d.ts` type augmentation in `shared/` — enables type-safe `req.session.userId` and `req.session.districtId` without casting.
- Wired session middleware in `web/index.ts` before all route handlers; `pgPool` is a separate `pg.Pool` instance (not Prisma) per AR3. `createTableIfMissing: true` auto-creates the `sessions` table.
- Middleware order: `morgan → session → express.json() → webhookRouter → authRouter`.
- `POST /api/auth/login` route in `auth/routes.ts`: validates body types, checks in-memory rate limiter before DB lookup, verifies argon2 hash (hash first, plain second), clears counter on success, sets `req.session.userId` + `req.session.districtId`.
- Rate limiter is module-level Map — tests use distinct usernames to avoid state leakage between test cases.
- All 86 tests pass (80 existing + 6 new). `pnpm lint` and `pnpm exec tsc --noEmit` both pass.

### File List

- `apps/server/package.json` (modified — express-session, connect-pg-simple added)
- `pnpm-lock.yaml` (modified — lockfile updated)
- `apps/server/src/shared/env.ts` (modified — SESSION_SECRET added to EnvSchema)
- `apps/server/src/shared/session.d.ts` (new — express-session type augmentation)
- `apps/server/src/auth/routes.ts` (new — login route + in-memory rate limiter)
- `apps/server/src/auth/index.ts` (new — barrel export of authRouter)
- `apps/server/src/auth/routes.test.ts` (new — 6 Vitest tests for login route)
- `apps/server/src/web/index.ts` (modified — session middleware + authRouter mounted)
