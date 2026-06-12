# Story 2.2: Protected Routes & District Scope Enforcement

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **authorized user**,
I want all dashboard API endpoints to require a valid session and automatically scope data to my district,
so that unauthenticated users are rejected and no cross-district data leakage is possible.

## Acceptance Criteria

1. **Given** the `requireAuth` middleware is applied to all `/api/*` routes except `/api/auth/*`
   **When** a request arrives without a valid session cookie
   **Then** the server returns HTTP 401 `{ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' }` and no data is returned

2. **And** when a valid session exists, every downstream protected query uses `req.session.districtId` for district scope — no endpoint reads `districtId` from the request body, query params, or route params

3. **And** all Prisma queries that read signals, mahallas, health data, or keywords include `WHERE district_id = req.session.districtId`

4. **And** `pnpm lint` and `pnpm test` pass; unit tests cover: missing session -> 401, session missing `districtId` -> 401, valid session -> protected handler receives the session district, `districtId` from query/body is ignored, `/api/auth/*` remains reachable without `requireAuth`, and `/webhook` remains outside dashboard auth enforcement

## Tasks / Subtasks

- [ ] Task 1: Create `requireAuth` middleware (AC: 1, 2)
  - [ ] 1.1 Create `apps/server/src/auth/middleware.ts`
  - [ ] 1.2 Implement `requireAuth` that checks `req.session.userId` and `req.session.districtId` exist
  - [ ] 1.3 On missing session data → respond 401 with standard error shape
  - [ ] 1.4 On valid session → call `next()` (districtId is already on `req.session`)

- [ ] Task 2: Export `requireAuth` from auth barrel (AC: 1)
  - [ ] 2.1 Add `requireAuth` export to `apps/server/src/auth/index.ts`

- [ ] Task 3: Wire `requireAuth` in `web/index.ts` (AC: 1, 2)
  - [ ] 3.1 Import `requireAuth` from `../auth/index.js`
  - [ ] 3.2 Apply `requireAuth` to a route group covering all `/api/*` routes EXCEPT `/api/auth/*`
  - [ ] 3.3 Maintain correct middleware ordering: `session → json → webhookRouter → authRouter → requireAuth → protected routes`

- [ ] Task 4: Create placeholder protected routes to validate middleware (AC: 2, 3)
  - [ ] 4.1 Add a minimal `GET /api/signals` placeholder route that is behind `requireAuth` and returns `[]` for now (actual signal queries arrive in Epic 3 Story 3.2)
  - [ ] 4.2 Add a minimal `GET /api/mahallas` placeholder route that queries `mahallas WHERE district_id = req.session.districtId`
  - [ ] 4.3 Add a minimal `GET /api/health` placeholder route that returns the future-compatible minimum health shape `{ status: 'no_data', lastBatchAt: null, lastBatchStatus: null, messagesProcessed: null, signalsWritten: null, queueDepth: 0 }`

- [ ] Task 5: Write tests in `apps/server/src/auth/middleware.test.ts` (AC: 4)
  - [ ] 5.1 Test: request without session cookie → 401
  - [ ] 5.2 Test: request with `userId` but missing `districtId` in session → 401
  - [ ] 5.3 Test: request with valid session → handler receives correct districtId from session
  - [ ] 5.4 Test: request with `districtId` in query param → districtId from session used, not from query
  - [ ] 5.5 Test: request with `districtId` in body → districtId from session used, not from body
  - [ ] 5.6 Test: `/api/auth/*` route registered before `requireAuth` remains reachable without a session
  - [ ] 5.7 Test: `/webhook` or a webhook-shaped non-`/api` route remains outside the `/api` auth guard

- [ ] Task 6: Pre-commit verification (AC: 4)
  - [ ] 6.1 `pnpm lint` passes
  - [ ] 6.2 `pnpm test` passes (all existing tests + new middleware tests)
  - [ ] 6.3 `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` passes

## Dev Notes

### Critical Architecture Rule: AR6 — District Scope Enforcement

**Core invariant:** `districtId` MUST always come from `req.session.districtId` — NEVER from `req.body`, `req.query`, or `req.params`. This is the primary security boundary for data isolation.

From Architecture Section 6:
> "Authorization middleware: Guard on all `/api/*` routes except `/api/auth/*`. Reads `req.session.userId` + `req.session.districtId` and injects `districtId` into all downstream queries."

From Architecture Section 13:
```typescript
// Correct:
const signals = await getSignals({ districtId: req.session.districtId, ...filters })
// Wrong:
const signals = await getSignals({ districtId: req.body.districtId })
```

---

### Task 1 Deep Dive: `requireAuth` Middleware

**File:** `apps/server/src/auth/middleware.ts`

The architecture specifies `auth/middleware.ts` for this middleware (see project structure, line 188 of architecture doc).

```typescript
// apps/server/src/auth/middleware.ts
import type { Request, Response, NextFunction } from 'express'

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.userId || !req.session.districtId) {
    res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: 'Authentication required',
    })
    return
  }

  next()
}
```

**Key decisions:**
- Check BOTH `userId` AND `districtId` — a session without districtId is invalid even if userId exists.
- Use `void` return type — Express middleware should not return the response.
- `req.session.userId` and `req.session.districtId` are typed via `session.d.ts` augmentation (created in Story 2.1). No casting needed.
- Error shape matches AR16: `{ statusCode, error, message }`.
- No logging of session details — avoid exposing session state in logs for failed auth.
- This is a simple synchronous middleware — no `async` needed, no try/catch needed.

**What this middleware does NOT do:**
- It does NOT set districtId on `req` or create a custom property. Downstream routes read `req.session.districtId` directly.
- It does NOT validate the user still exists in the DB (session-based auth trusts the session store).
- It does NOT check `is_active` on every request (login already checks this; an admin panel for deactivation is Phase 2+).

---

### Task 2 Deep Dive: Auth Barrel Export

**Current `auth/index.ts`:**
```typescript
export { default as authRouter } from './routes.js'
```

**Required update — add `requireAuth` re-export:**
```typescript
export { default as authRouter } from './routes.js'
export { requireAuth } from './middleware.js'
```

---

### Task 3 Deep Dive: Wiring `requireAuth` in `web/index.ts`

**Current `web/index.ts` middleware stack (57 lines):**
```
morgan → session → express.json() → webhookRouter → authRouter
```

**Required addition — mount `requireAuth` before all protected `/api/*` routes:**

The webhook (`POST /webhook`) is NOT under `/api` namespace — it must NOT require auth. Auth routes (`/api/auth/*`) must NOT require auth — they ARE the auth endpoints.

**Approach — use Express path-scoped middleware:**

```typescript
import { authRouter, requireAuth } from '../auth/index.js'

// After authRouter, before any other /api/* routes:
app.use('/api/auth', authRouter)          // auth routes — no requireAuth
app.use('/api', requireAuth)              // all other /api/* routes require auth
// Future protected routes go here:
// app.use('/api/signals', signalsRouter)
// app.use('/api/mahallas', mahallasRouter)
// app.use('/api/health', healthRouter)
```

**Key constraint:** `app.use('/api', requireAuth)` must come AFTER `app.use('/api/auth', authRouter)`. Express evaluates middleware in registration order — a request to `POST /api/auth/login` will match the authRouter first and be handled before reaching the requireAuth middleware.

**Updated middleware order in `web/index.ts`:**
```
morgan → session → express.json() → webhookRouter → authRouter (/api/auth) → requireAuth (/api) → placeholder protected routes
```

---

### Task 4 Deep Dive: Placeholder Protected Routes

This story establishes the `requireAuth` guard. Future stories (Epic 3+) will implement the actual route handlers. For now, minimal placeholder routes validate that:
1. The middleware correctly blocks unauthenticated access
2. Downstream routes can read `req.session.districtId`

**Required placement for this story:** keep the three placeholder routes inline in `apps/server/src/web/index.ts`, after `app.use('/api', requireAuth)`. These placeholders exist only to prove the guard and district-scoping pattern before the full route modules arrive in later stories. Do not create `signals/`, `mahallas/`, or `health/` route modules in this story.

**Placeholder signals route:**
```typescript
// Minimal — returns empty array. Full implementation in Story 3.2.
app.get('/api/signals', (_req, res) => {
  res.json([])
})
```

**Placeholder mahallas route (with actual district-scoped query):**
```typescript
// This route can do a real query to validate district scoping works end-to-end.
import { prisma } from '../shared/db.js'

app.get('/api/mahallas', async (req, res) => {
  const mahallas = await prisma.mahalla.findMany({
    where: { district_id: req.session.districtId },
    select: { id: true, district_id: true, name: true },
  })
  res.json(mahallas.map(m => ({
    id: m.id,
    districtId: m.district_id,
    name: m.name,
  })))
})
```

**Placeholder health route:**
```typescript
// Minimal — full implementation in Epic 5 Story 5.1.
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'no_data',
    lastBatchAt: null,
    lastBatchStatus: null,
    messagesProcessed: null,
    signalsWritten: null,
    queueDepth: 0,
  })
})
```

**Why health uses `status: 'no_data'`:** Story 5.1 defines the final `/api/health` contract as `{ status: 'current' | 'delayed' | 'no_data', lastBatchAt, lastBatchStatus, messagesProcessed, signalsWritten, queueDepth }`. The placeholder must not introduce a temporary `'ok'` status that the frontend could accidentally depend on.

**Replacement comments:** Add short TODO comments above each placeholder so later stories can find and replace them:
- `GET /api/signals`: replace in Story 3.2.
- `GET /api/health`: replace in Story 5.1.
- `GET /api/mahallas`: replace or move when the dashboard mahalla filter route is implemented.

---

### Task 5 Deep Dive: Testing `requireAuth` Middleware

**Test file:** `apps/server/src/auth/middleware.test.ts`

Follow the same Vitest + supertest pattern established in `routes.test.ts` (Story 2.1):
- `vi.hoisted()` for mock values used in `vi.mock()` factories
- `vi.mock()` for env, db, logger
- In-memory session store (no DB needed)
- Distinct test usernames to avoid rate limiter state leakage

**Test app factory:**
```typescript
import express from 'express'
import session from 'express-session'
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
```

**Test cases:**

```typescript
describe('requireAuth middleware', () => {
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
  })

  it('returns 401 when session has userId but no districtId', async () => {
    const app = createTestApp()
    const agent = request.agent(app)

    await agent.post('/test/login').send({ userId: 1 })

    const res = await agent.get('/api/test-protected')

    expect(res.status).toBe(401)
    expect(res.body.message).toBe('Authentication required')
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
```

**Test intent:** The query/body tests prove the protected handler uses `req.session.districtId` even when client-controlled request data contains a different `districtId`. The middleware does not rewrite `req.body` or `req.query`; downstream handlers must still ignore those values for data scope.

---

### Anti-Patterns to Prevent

| ❌ Wrong | ✅ Correct |
|---|---|
| `req.body.districtId`, `req.query.districtId`, or `req.params.districtId` for scoping | `req.session.districtId` — always from session |
| `app.use(requireAuth)` before authRouter | `requireAuth` must come AFTER authRouter registration |
| `requireAuth` on webhook route (`/webhook`) | Webhook is NOT under `/api` — exempt by path |
| Async `requireAuth` with DB lookup per request | Synchronous session check — no DB query |
| `(req.session as any).districtId` | Type-safe via `session.d.ts` augmentation |
| Setting `req.districtId = req.session.districtId` | Read directly from `req.session.districtId` in handlers |
| `res.sendStatus(401)` | Full error shape: `{ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' }` |
| Temporary `/api/health` response with `status: 'ok'` | Future-compatible health shape with `status: 'no_data'` until Story 5.1 implements real health state |

---

### Files to Create / Modify Summary

| File | Action | Why |
|---|---|---|
| `apps/server/src/auth/middleware.ts` | NEW | `requireAuth` middleware implementation |
| `apps/server/src/auth/middleware.test.ts` | NEW | Unit tests for requireAuth |
| `apps/server/src/auth/index.ts` | MODIFY | Re-export `requireAuth` from barrel |
| `apps/server/src/web/index.ts` | MODIFY | Wire `requireAuth` + placeholder routes |

**Do NOT touch:** `auth/routes.ts` (login — unchanged), `session.d.ts` (already done), `schema.prisma` (no schema changes), `env.ts` (no new env vars), `classifier/`, `bot/`, `keywords/` modules.

---

### Project Structure Notes

- `auth/middleware.ts` placement matches architecture project structure (line 188 of `architecture.md`).
- Module boundary rule (AR15): `auth/` owns `users` + sessions. The middleware reads session data only — no cross-module DB access.
- Placeholder routes in `web/index.ts` are temporary. They will be replaced by dedicated module routers in later stories (signals/ in Story 3.2, health/ in Story 3.4/5.1).
- `.js` extension required on all imports (TypeScript NodeNext resolution, established in Epic 1).

### Cross-Epic Context (Story 2.1 Learnings)

- All imports use `.js` extension (TypeScript NodeNext resolution). e.g. `import { requireAuth } from './middleware.js'`
- `vi.hoisted()` is required for mock values used inside `vi.mock()` factory functions.
- `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` — scope TypeScript check to server package.
- `pnpm test` runs ALL Vitest tests project-wide — ensure all existing tests + new tests pass.
- In-memory session store for tests — no DB needed for auth middleware unit tests.
- Use `request.agent(app)` from supertest to persist cookies across requests in the same test.
- Express `IRouter` type annotation pattern from Story 2.1: `const router: IRouter = Router()` — use this if TS2742 errors appear.
- Story 2.1 debug finding: barrel imports must use `.js` extension and the barrel must re-export correctly.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 6: Authentication & Security]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 7: API & Communication Patterns (endpoint list)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 13: Implementation Patterns (district scope rule)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 14: Module Boundaries (auth/ boundary)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 3: Project Structure (auth/middleware.ts)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.2]
- [Source: `_bmad-output/implementation-artifacts/2-1-login-and-session-issuance.md` — Dev notes: middleware order, session type augmentation, testing patterns]
- [Source: `apps/server/src/web/index.ts` — current server entry (requireAuth not yet wired)]
- [Source: `apps/server/src/auth/index.ts` — current barrel (only authRouter exported)]
- [Source: `apps/server/src/shared/session.d.ts` — userId and districtId typed on session]

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
