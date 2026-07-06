# Story 2.3: Logout & Session Invalidation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **authorized user**,
I want to log out and have my session immediately invalidated,
so that my access is revoked and no one can reuse my session cookie after I leave.

## Acceptance Criteria

1. **Given** an authenticated user with a valid session cookie
   **When** the user calls `POST /api/auth/logout`
   **Then** the server destroys the session in the PostgreSQL session store and returns HTTP 200

2. **And** subsequent requests using the same session cookie return HTTP 401 (`requireAuth` middleware rejects the dead session)

3. **And** the `Set-Cookie` response header clears the session cookie (`maxAge=0` or `expires` in the past)

4. **And** `pnpm lint` and `pnpm test` pass

## Tasks / Subtasks

- [x] Task 1: Add `POST /api/auth/logout` route to `auth/routes.ts` (AC: 1, 2, 3)
  - [x] 1.1 Call `req.session.destroy(err => ...)` to delete session from PostgreSQL session store
  - [x] 1.2 On success: call `res.clearCookie(...)` then respond `200 { ok: true }`
  - [x] 1.3 On destroy error: log the error and respond `500` with standard error shape
  - [x] 1.4 Ensure the handler is registered under the existing `authRouter` — no new router needed

- [x] Task 2: Write tests in `apps/server/src/auth/routes.test.ts` (AC: 1, 2, 3, 4)
  - [x] 2.1 Test: authenticated user calls logout → 200, session is destroyed
  - [x] 2.2 Test: subsequent request using the original pre-logout cookie → 401 from `requireAuth`
  - [x] 2.3 Test: logout response includes `Set-Cookie` header that clears the cookie with matching non-expiry cookie attributes
  - [x] 2.4 Test: unauthenticated logout call (no session) → 200 (idempotent — no error to the user)

- [x] Task 3: Pre-commit verification (AC: 4)
  - [x] 3.1 `pnpm lint` passes
  - [x] 3.2 `pnpm test` passes (all 97 tests: 93 existing + 4 new logout tests)
  - [x] 3.3 `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` passes

## Dev Notes

### Core Implementation: `req.session.destroy()` Pattern

`express-session` exposes `req.session.destroy(callback)` which:
1. Removes the session record from the **PostgreSQL session store** (`sessions` table via `connect-pg-simple`).
2. Clears `req.session` in the current request.

The session cookie in the browser must also be cleared manually using `res.clearCookie()`. `session.destroy()` alone does NOT send a Set-Cookie response header.

**The complete logout handler:**

```typescript
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
```

**Key decisions:**
- `'connect.sid'` is the default cookie name for `express-session`. The existing session setup in `web/index.ts` does not set a custom `name:` option, so `'connect.sid'` is correct.
- `res.clearCookie()` sends `Set-Cookie: connect.sid=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; ...` — this is how the browser is told to delete the cookie. AC 3 requires this.
- Pass the same non-expiry cookie attributes used by the session middleware (`path`, `httpOnly`, `sameSite`, `secure`) when clearing the cookie. Do **not** pass `maxAge` or `expires` to `res.clearCookie()`; Express handles expiry for clear-cookie responses.
- The handler is synchronous-ish (callback style, not async/await). Do NOT use `async` on this route — there is no `await`. The `destroy()` callback is the error channel.
- **Idempotency:** If the user calls logout with an invalid/expired/missing session, `req.session.destroy()` still calls the callback without error (or with a non-fatal error that can be ignored gracefully). Return 200 in both cases — the end state is the same (no valid session). Alternatively, check `req.session.userId` and skip `destroy()` if no session exists, returning 200 immediately.

### Route Registration — Existing `authRouter` in `routes.ts`

**File to modify:** `apps/server/src/auth/routes.ts` — add the logout route alongside the existing login route.

**Current state of `routes.ts`** (105 lines):
- Defines `const router: IRouter = Router()` at line 53
- Has `router.post('/login', async (req, res) => { ... })` at line 55
- Exports `export default router`

**Add this after the login handler, before `export default router`:**
```typescript
router.post('/logout', (req, res) => {
  // ... implementation above ...
})
```

The `authRouter` is mounted at `app.use('/api/auth', authRouter)` in `web/index.ts`, so this becomes `POST /api/auth/logout` — exactly what the architecture specifies.

**Do NOT:**
- Create a new router file or module for this — it's two lines in the existing `routes.ts`.
- Move the router to a new file — story 2.4 (frontend flow) may extend `routes.ts` further.
- Add it under `app.use('/api', requireAuth)` in `web/index.ts` — logout must remain under `/api/auth/*` (exempt from `requireAuth`) so that logout works even if the session is partially invalid.

### Why Logout Must Bypass `requireAuth`

The logout endpoint must be reachable when:
- The session cookie is present but the session record has already expired in the DB
- The session `userId` or `districtId` is missing from the cookie data

Placing logout at `POST /api/auth/logout` (under `authRouter`, registered **before** `requireAuth`) means it is never blocked by the middleware. This is intentional — `requireAuth` only guards routes registered under `app.use('/api', requireAuth)`.

### Cookie Name Verification

The `express-session` default cookie name is `'connect.sid'`. The existing session config in `apps/server/src/web/index.ts` (lines 20–35) does not specify a custom `name` option:

```typescript
app.use(session({
  store: new PgStore({ ... }),
  secret: env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  },
}))
```

No `name:` field → default `'connect.sid'` is used → clear `'connect.sid'` with the same non-expiry cookie attributes used by the session middleware.

### NFR10 Compliance

NFR10: "Session tokens are invalidated immediately on logout."

`req.session.destroy()` calls `connect-pg-simple` which runs `DELETE FROM sessions WHERE sid = ?` synchronously within the destroy callback. The session is gone from the store before the `200` response is sent — this satisfies "immediately on logout."

### Testing Pattern — Extend `routes.test.ts`

Add logout tests to the **existing** `apps/server/src/auth/routes.test.ts`. Do NOT create a separate file.

Current test file structure:
- Mocks: `env`, `db` (prisma), `argon2`, `logger`
- `createTestApp()` factory: uses `MemoryStore` (in-memory express-session), mounts `authRouter` at `/api/auth`
- `describe('POST /api/auth/login', ...)` block with 6 tests

**For the logout tests, extend `createTestApp()` to also wire `requireAuth`** (for testing AC 2 — subsequent request returns 401):

```typescript
import { authRouter, requireAuth } from './index.js'

function createTestApp() {
  const app = express()
  app.use(express.json())
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 },
  }))
  app.use('/api/auth', authRouter)
  // Wire requireAuth to test that post-logout requests are properly rejected
  app.use('/api', requireAuth)
  app.get('/api/test-protected', (req, res) => {
    res.json({ districtId: req.session.districtId })
  })
  app.get('/test/session', (req, res) => {
    res.json({ userId: req.session.userId, districtId: req.session.districtId })
  })
  return app
}
```

**IMPORTANT:** The existing `createTestApp()` in `routes.test.ts` currently does NOT include `requireAuth`. Adding it will NOT break existing login tests — `requireAuth` only applies to `/api/*` routes that are not `/api/auth/*`. The existing test for `/test/session` is also unaffected.

**Logout test cases:**

```typescript
describe('POST /api/auth/logout', () => {
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
    // Set-Cookie header should include the session cookie with expiry in the past
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
```

**Why `vi.mocked(prisma.user.findUnique).mockResolvedValueOnce` in logout tests:**
Login is called first to establish a session. Mocking is required because `routes.test.ts` already mocks `prisma` and `argon2`.

**Note on `Set-Cookie` assertion:** `connect-pg-simple` with an in-memory MemoryStore may not send the exact same `Expires=` format as PostgreSQL-backed sessions. The test should be permissive — just verify the cookie name appears and has an expired/cleared value. If the exact header is unreliable in-memory, the assertion can be relaxed to just check `res.status === 200` for the cookie clearing scenario and rely on the "subsequent 401" test to prove invalidation.

### Anti-Patterns to Prevent

| ❌ Wrong | ✅ Correct |
|---|---|
| `req.session = null` or `delete req.session` | `req.session.destroy(callback)` — only this removes from the store |
| Forgetting `res.clearCookie()` | Always call after destroy succeeds — browser must be told to delete the cookie |
| Testing post-logout access only through `request.agent(app)` after the clear-cookie response | Reuse the original pre-logout cookie in a separate request to prove server-side session invalidation |
| Hardcoding `'connect.sid'` differently | The default is `'connect.sid'`; no custom name is set in this project |
| Using `async/await` on the logout handler | `session.destroy()` is callback-based — use the callback pattern |
| Placing logout under `requireAuth` guard | Logout is under `/api/auth/` which is exempt from `requireAuth` — intentional |
| Returning 401 when unauthenticated user calls logout | Return 200 — the end-state is the same (no valid session) |
| Creating a separate `logout.ts` file | Add to existing `routes.ts` — it's one small handler |

### Files to Create / Modify Summary

| File | Action | What changes |
|---|---|---|
| `apps/server/src/auth/routes.ts` | MODIFY | Add `router.post('/logout', ...)` handler |
| `apps/server/src/auth/routes.test.ts` | MODIFY | Extend `createTestApp()` + add 4 logout test cases |

**Do NOT touch:** `auth/index.ts` (no new exports needed), `auth/middleware.ts` (unchanged), `web/index.ts` (router already mounted), `session.d.ts` (no new session fields), `schema.prisma` (no schema changes).

### Project Structure Notes

- `auth/routes.ts` is the single router file for all auth endpoints per architecture project structure (line 187: `routes.ts ← POST /api/auth/login, POST /api/auth/logout`).
- Module boundary rule (AR15): `auth/` owns users + sessions. This handler is entirely within that boundary.
- `.js` extension required on all imports (TypeScript NodeNext resolution) — already consistent with `routes.ts`.
- The `sessions` PostgreSQL table is managed by `connect-pg-simple` (created via `createTableIfMissing: true`). `session.destroy()` writes directly to this table.

### Cross-Story Context (Stories 2.1 and 2.2 Learnings)

- All test mocks use `vi.hoisted()` for values used inside `vi.mock()` factory functions.
- `pnpm test` runs ALL Vitest tests project-wide — all 93 existing tests must continue to pass.
- Use `request.agent(app)` from supertest to persist cookies across login → logout → subsequent request in the same test.
- TypeScript check scope: `pnpm exec tsc -p apps/server/tsconfig.json --noEmit`.
- The `IRouter` type annotation pattern: `const router: IRouter = Router()` already in `routes.ts` — no change needed.
- `logger` is already imported in `routes.ts` — use it for the `session.destroy` error path.
- Barrel `auth/index.ts` already exports both `authRouter` and `requireAuth` — import both in the updated test helper.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — Epic 2, Story 2.3]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 6: Authentication & Security (session setup, AR10)]
- [Source: `_bmad-output/planning-artifacts/architecture.md` — Section 7: API Endpoints (`POST /api/auth/logout`)]
- [Source: `_bmad-output/planning-artifacts/epics.md` — NFR10: Session tokens invalidated immediately on logout]
- [Source: `apps/server/src/auth/routes.ts` — existing login route and router setup]
- [Source: `apps/server/src/auth/routes.test.ts` — existing test structure and mocking patterns]
- [Source: `apps/server/src/web/index.ts` — session cookie config (no custom name → default `connect.sid`)]
- [Source: `apps/server/src/auth/middleware.ts` — `requireAuth` pattern for post-logout 401 test]
- [Source: `_bmad-output/implementation-artifacts/2-2-protected-routes-and-district-scope-enforcement.md` — middleware test patterns, `request.agent()` usage]
- [Source: `_bmad-output/implementation-artifacts/2-1-login-and-session-issuance.md` — session setup, `vi.hoisted()` patterns]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

_No issues encountered — clean implementation._

### Completion Notes List

- Implemented `router.post('/logout', ...)` in `apps/server/src/auth/routes.ts` using callback-based `req.session.destroy()` pattern (not async/await per story spec).
- Cookie cleared via `res.clearCookie('connect.sid', { path, httpOnly, sameSite, secure })` — matching non-expiry attributes from session middleware; `maxAge`/`expires` intentionally omitted per story guidance.
- Logout handler registered on existing `authRouter` under `/api/auth`; exempt from `requireAuth` by route order — no `web/index.ts` change needed.
- Returns `200 { ok: true }` for both authenticated and unauthenticated calls (idempotent — AC 4).
- Extended `createTestApp()` in `routes.test.ts` to wire `requireAuth` on `/api` and add `/api/test-protected` route — existing 6 login tests unaffected.
- 4 new logout tests added: 200 success, Set-Cookie header clearing verification, original pre-logout cookie rejected with 401 (server-side invalidation proof), unauthenticated 200.
- All 97 tests pass (`pnpm test`), lint clean (`pnpm lint`), type-check clean (`tsc --noEmit`).

### File List

- `apps/server/src/auth/routes.ts` — MODIFIED: added `router.post('/logout', ...)` handler
- `apps/server/src/auth/routes.test.ts` — MODIFIED: extended `createTestApp()` with `requireAuth` + `/api/test-protected`; added `describe('POST /api/auth/logout', ...)` with 4 tests

## Change Log

| Date | Description |
|---|---|
| 2026-06-13 | Implemented Story 2.3: added `POST /api/auth/logout` handler and 4 test cases; all 97 tests pass |

