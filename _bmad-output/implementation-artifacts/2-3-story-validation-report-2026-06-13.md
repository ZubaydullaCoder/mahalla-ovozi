# Story Validation Report: 2.3 Logout & Session Invalidation

Date: 2026-06-13
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/2-3-logout-and-session-invalidation.md`

## Validation Scope

- Checked Story 2.3 against Epic 2 Story 2.3 acceptance criteria, architecture authentication/session guidance, PRD FR31/NFR10, project context, sprint status, and Story 2.1/2.2 implementation learnings.
- Verified current code state: `auth/routes.ts` owns auth endpoints, `auth/index.ts` exports `authRouter` and `requireAuth`, `web/index.ts` mounts `/api/auth` before protected `/api` routes, and `requireAuth` already rejects sessions missing `userId` or `districtId`.
- Verified current dependency behavior against authoritative docs: `express-session` `req.session.destroy(callback)` destroys the current session and unsets `req.session`; Express `res.clearCookie()` is the correct response API for clearing the browser cookie and should receive matching non-expiry cookie attributes.
- Ran current baseline checks before implementation: `pnpm lint`, `pnpm test`, and `pnpm exec tsc -p apps/server/tsconfig.json --noEmit`.

## Applicability Result

Story 2.3 is applicable in the current codebase and is the correct next implementation story after Story 2.2. The story should remain `ready-for-dev` and proceed to `bmad-dev-story`.

## Corrections Applied

1. Strengthened the post-logout invalidation test.

   The story now requires reusing the original pre-logout cookie in a separate request after logout. This proves the server-side session record is invalidated, instead of only proving that `request.agent(app)` honored the clear-cookie response.

   Risk if not fixed: tests could pass even if the server failed to invalidate the old session record, because the test client might simply stop sending the cookie.

2. Tightened cookie-clearing guidance.

   The story now says to pass matching non-expiry cookie attributes (`path`, `httpOnly`, `sameSite`, `secure`) to `res.clearCookie()` and not to pass `maxAge` or `expires`.

   Risk if not fixed: cookie clearing could become brittle if cookie attributes change later, and future Express behavior discourages explicit expiry options in `clearCookie()`.

3. Improved the `Set-Cookie` assertion expectations.

   The story now asks tests to verify the cookie name, expired/cleared state, `Path=/`, `HttpOnly`, and `SameSite=Strict`, while still keeping the exact expiry assertion permissive.

   Risk if not fixed: tests could accept a response that looks successful but does not reliably clear the same session cookie used by the app.

4. Clarified the cookie name section.

   The story still correctly uses the default `connect.sid` cookie name, but now frames the requirement as clearing that cookie with matching non-expiry attributes rather than calling `res.clearCookie('connect.sid')` bare.

## Confirmed Valid

- `POST /api/auth/logout` belongs in `apps/server/src/auth/routes.ts`; no new router/module is needed.
- Logout must remain under `/api/auth` and outside `requireAuth`; this matches the current route order in `apps/server/src/web/index.ts`.
- `req.session.destroy(callback)` is the correct store-invalidation mechanism for the PostgreSQL-backed `connect-pg-simple` session store.
- Clearing the browser cookie is still required because destroying the server-side session does not itself send a clear-cookie header.
- Returning `200 { ok: true }` for unauthenticated logout is appropriate because logout is idempotent and the desired end state is no valid session.
- The standard error shape for destroy failures remains `{ statusCode, error, message }`.
- The test location is correct: extend `apps/server/src/auth/routes.test.ts`; use `request.agent(app)` for login/logout flow and a separate request with the captured original cookie for server-side invalidation proof.
- No dependency, Prisma schema, environment variable, session type, frontend, or architecture change is needed.

## Verification

- `pnpm lint` passed.
- `pnpm test` passed: 10 test files, 93 tests.
- `pnpm exec tsc -p apps/server/tsconfig.json --noEmit` passed.

## Residual Notes

- This validation did not implement Story 2.3 application code.
- The current test suite uses `MemoryStore`, which is appropriate for unit-level auth route tests. The production PostgreSQL store behavior is exercised through the same `express-session` `destroy()` contract.

## Recommendation

Keep Story 2.3 in `ready-for-dev` and run `bmad-dev-story` for implementation.

