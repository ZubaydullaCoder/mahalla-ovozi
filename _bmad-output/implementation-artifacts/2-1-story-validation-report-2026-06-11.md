# Story Validation Report: 2.1 Login & Session Issuance

Date: 2026-06-11
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/2-1-login-and-session-issuance.md`

## Validation Scope

- Checked Story 2.1 against Epic 2 Story 2.1 acceptance criteria, architecture authentication/session guidance, sprint status, current server code, current Prisma `User` model, current package state, `.env.example`, and previous Epic 1 story learnings.
- Verified workflow state: Epic 1 is `done`; Epic 2 is `in-progress`; Story 2.1 is marked `ready-for-dev`; Story 2.2 remains `backlog`.
- Verified current code state: `SESSION_SECRET` exists in `.env.example` but is missing from `apps/server/src/shared/env.ts`; `apps/server/src/web/index.ts` has no session middleware or auth router; `argon2` and `pg` are installed; `express-session` and `connect-pg-simple` are not installed yet.
- Checked current dependency docs for `express-session` and `connect-pg-simple` session store setup: `store`, `secret`, `resave: false`, `saveUninitialized: false`, cookie `httpOnly`/`sameSite`/`maxAge`, `pg.Pool`, and `createTableIfMissing` are valid for this story.

## Applicability Result

Story 2.1 is applicable in the current codebase and is the correct next story before protected routes, logout, and frontend auth flow.

After the validation edits below, the story is ready for `bmad-dev-story`.

## Corrections Applied

1. Removed contradictory auth router mounting guidance.

   The story now requires `authRouter` to be mounted after session middleware and after `express.json()` so `req.body` is populated for `POST /api/auth/login`.

   Risk if not fixed: mounting the auth router before JSON parsing would make valid login bodies unavailable and cause the login handler to return 400 or behave incorrectly.

2. Aligned rate-limit behavior with the acceptance criteria.

   The story now says the limiter tracks failed login attempts, blocks the 6th attempt after 5 failures in a 60-second window, records failures only for invalid/inactive credentials, and clears the username counter on successful login.

   Risk if not fixed: the previous example incremented the counter before credential validation, which could rate-limit a user after successful logins and conflicted with the AC wording: "after 5 failed login attempts."

3. Corrected the test task wording for the rate-limit trigger.

   The task now matches the detailed test example: 5 failed attempts are allowed to return 401, and the 6th attempt returns 429.

   Risk if not fixed: one dev agent could implement/test the 5th attempt as blocked while another follows the AC and blocks only subsequent attempts.

## Confirmed Valid

- Scope is correct: login/session issuance only. Protected route enforcement belongs to Story 2.2, logout/session destruction belongs to Story 2.3, and frontend login UI belongs to Story 2.4.
- File locations match architecture and current repo structure: new auth module under `apps/server/src/auth/`, session type augmentation under `apps/server/src/shared/session.d.ts`, and middleware/router wiring in `apps/server/src/web/index.ts`.
- `connect-pg-simple` should use a separate `pg.Pool` with `env.DATABASE_URL`; it must not use Prisma and must not add a `sessions` model to `schema.prisma`.
- `User` schema supports the story requirements: `username`, `password_hash`, `district_id`, and `is_active` are present.
- Error response shape matches AR16: `{ statusCode, error, message }`.
- Session data requirements are clear: store `userId` and `districtId` server-side only; never expose them to client JavaScript.
- Current webhook router owns its own `express.json()` for `/webhook`, so adding global `express.json()` before `/api/auth` is acceptable when done carefully and should not remove the webhook-specific secret validation.
- Previous story learnings are included: NodeNext `.js` imports, `vi.hoisted()` for Vitest mocks, scoped server typecheck, and `pnpm lint` / `pnpm test` verification.

## Residual Notes

- The story intentionally does not add session fixation hardening via `req.session.regenerate()`; the story notes this as a higher-security future option. This is acceptable for Phase 1 scope because architecture did not require regeneration.
- The story intentionally uses an in-memory login limiter. This is acceptable for Phase 1 single-process validation and matches architecture, but it is not a production distributed rate limiter.
- No application code checks were run because this validation changed story documentation only, not executable code.

## Recommendation

Keep Story 2.1 in `ready-for-dev` and run `bmad-dev-story` for implementation.

