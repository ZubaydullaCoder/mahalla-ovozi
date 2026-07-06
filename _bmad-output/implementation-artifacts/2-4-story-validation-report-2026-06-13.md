# Story Validation Report: 2.4 Frontend Auth Flow

Date: 2026-06-13
Status: Passed after validation edit
Story file: `_bmad-output/implementation-artifacts/2-4-frontend-auth-flow-login-page-and-protected-route-guard.md`

## Validation Scope

- Checked Story 2.4 against Epic 2 Story 2.4 acceptance criteria, PRD FR30, architecture frontend routing/theme guidance, UX design-system guidance, project context, sprint status, current frontend scaffold, current backend auth code from Stories 2.1-2.3, and prior story validation reports.
- Verified workflow state: Epic 2 is `in-progress`; Stories 2.1, 2.2, and 2.3 are `done`; Story 2.4 is marked `ready-for-dev`; Epic 3 remains `backlog`.
- Verified current code state: frontend is still the Vite scaffold; `strings.ts` is empty; backend `POST /api/auth/login`, `POST /api/auth/logout`, `requireAuth`, and protected `GET /api/signals` placeholder exist.
- Verified current dependency behavior against authoritative docs: React Router v6.30 route syntax with `BrowserRouter`, `Routes`, `Route`, `Navigate replace`, and `navigate(..., { replace: true })` is valid; AntD ConfigProvider token theming and Form/Input/Button primitives are valid for the story.

## Applicability Result

Story 2.4 is applicable in the current codebase and is the correct next implementation story after Story 2.3. After the validation edit below, it should remain `ready-for-dev` and proceed to `bmad-dev-story`.

## Correction Applied

1. Aligned the frontend login success contract with implemented backend behavior.

   The story previously modeled `LoginSuccessResponse` as `{ userId, districtId }` and listed `/api/auth/login` success as `200 { userId, districtId }`. Current Story 2.1 implementation and tests return `200 { ok: true }`; `userId` and `districtId` are stored server-side in the session and must not be exposed to client JavaScript.

   Risk if not fixed: the dev agent could implement incorrect frontend types, assume user/district data is available client-side, or introduce an unnecessary backend contract change in a frontend-only story.

2. Updated the `AuthGuard` probe wording for the current `/api/signals` placeholder.

   The story now states authenticated `GET /api/signals` returns the current `200 []` placeholder and future Epic 3 will return the full `200` response.

   Risk if not fixed: low, because the guard logic already treated all non-401 statuses as authenticated, but the old `404 until Epic 3` wording no longer matched the current server.

## Confirmed Valid

- Scope is correct: frontend auth flow only. No server, Prisma, session, or auth middleware changes are needed.
- Route structure matches architecture: `/login` open, `/` guarded by `AuthGuard`, `/ops` not wrapped by frontend `AuthGuard` because Ops is server-guarded separately.
- Auth detection approach is correct for an `httpOnly` session cookie: do not read cookies or create `/api/auth/me`; probe a protected route and redirect on 401.
- Login UX matches product constraints: no public registration, no password reset, inline Uzbek Cyrillic errors, no page reload, no alert dialog, no toast.
- Centralized `strings.ts` requirement is correct and covered by the existing `check-uz-strings` Vitest test.
- Vite `/api` proxy to `http://localhost:3001` is needed for local dev; production same-origin behavior is unchanged.
- Frontend module settings support the story examples: `moduleResolution: "Bundler"` and `allowImportingTsExtensions: true` allow `.ts`/`.tsx` extension imports.
- AntD theme root and token strategy match the UX and architecture docs; Tailwind should not be introduced.
- Deleting or replacing Vite scaffold `App.tsx`/`App.css` is safe once `main.tsx` imports `AppRoutes` directly.

## Residual Notes

- The story intentionally does not add an auto-redirect away from `/login` when already authenticated; manual verification notes this as expected.
- The story intentionally does not add frontend tests. This is acceptable for current risk, but the dev agent should still run lint, all Vitest tests, and the frontend type-check.
- Current login page example uses inline structural styles. During implementation, prefer AntD tokens via `theme.useToken()` when practical, especially for colors already defined in `theme.ts`, while keeping the story scope narrow.

## Verification

- `pnpm lint` passed.
- `pnpm test` passed: 10 test files, 97 tests.
- `pnpm exec tsc -b apps/web/tsconfig.json` passed.

## Recommendation

Keep Story 2.4 in `ready-for-dev` and run `bmad-dev-story` for implementation.

