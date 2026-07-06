# Story Validation Report: 2.2 Protected Routes & District Scope Enforcement

Date: 2026-06-12
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/2-2-protected-routes-and-district-scope-enforcement.md`

## Validation Scope

- Checked Story 2.2 against Epic 2 Story 2.2 acceptance criteria, architecture authentication/session guidance, API contracts, project context, sprint status, current server entrypoint, current auth module, current session type augmentation, current Prisma schema, and Story 2.1 implementation learnings.
- Verified workflow state: Epic 2 is `in-progress`; Story 2.1 is `done`; Story 2.2 is `ready-for-dev`; Story 2.3 remains `backlog`.
- Verified current code state: `apps/server/src/web/index.ts` has PostgreSQL-backed session middleware, global JSON parsing, webhook router, and `/api/auth` router mounted; `requireAuth` is not implemented yet; no protected dashboard API routes are implemented yet.
- Checked current Express 4 and `express-session` behavior relevant to this story: middleware runs in registration order, path-scoped `app.use('/api', requireAuth)` protects later `/api/*` routes, session data lives server-side, and `req.session` is the expected access point for session data.

## Applicability Result

Story 2.2 is applicable in the current codebase and is the correct next story after Story 2.1. The story should remain `ready-for-dev` and proceed to `bmad-dev-story`.

## Corrections Applied

1. Tightened the acceptance criteria and task-level test requirements.

   The story now requires tests for missing session, session missing `districtId`, valid session access, query/body district injection attempts, `/api/auth/*` exemption, and webhook exemption.

   Risk if not fixed: a developer could implement only the happy path plus one 401 test and miss the security and route-ordering regressions that matter most.

2. Removed ambiguity around placeholder route organization.

   The story now requires inline placeholders in `apps/server/src/web/index.ts` for this story and explicitly says not to create new `signals/`, `mahallas/`, or `health/` route modules yet.

   Risk if not fixed: one dev agent could create premature route modules and broaden the story scope, while another could keep inline placeholders, creating inconsistent architecture and unnecessary churn.

3. Corrected the placeholder `/api/health` response shape.

   The story now uses the future-compatible minimum shape `{ status: 'no_data', lastBatchAt: null, lastBatchStatus: null, messagesProcessed: null, signalsWritten: null, queueDepth: 0 }` instead of temporary `{ status: 'ok', lastBatchAt: null }`.

   Risk if not fixed: frontend or later health work could accidentally depend on a non-final `'ok'` status that conflicts with Epic 5 Story 5.1.

4. Replaced the incomplete body-injection test example.

   The story now includes a complete test app harness with a POST protected route, session setup that can omit `districtId`, public auth route simulation, and webhook route simulation.

   Risk if not fixed: the dev agent would need to infer how to finish the test, increasing the chance of a skipped or weak body-injection check.

5. Clarified the district-scope invariant.

   The story now says protected queries use `req.session.districtId`; they must not read district scope from body, query params, or route params.

   Risk if not fixed: "inject districtId" could be misread as creating a new `req.districtId` property or allowing route params as a district source.

## Confirmed Valid

- Middleware placement is correct: session and JSON parsing already exist before `/api/auth`; `requireAuth` should be mounted after `/api/auth` and before any other `/api` routes.
- Webhook remains outside the `/api` namespace and must not be protected by dashboard session auth.
- `requireAuth` belongs in `apps/server/src/auth/middleware.ts` and should be re-exported from `apps/server/src/auth/index.ts`.
- Session typing exists in `apps/server/src/shared/session.d.ts`; no `any` cast is needed for `req.session.userId` or `req.session.districtId`.
- The middleware should be synchronous and should not perform a DB lookup on every request.
- Error response shape matches AR16: `{ statusCode, error, message }`.
- Prisma district scoping is supported by the schema: district-owned tables include `district_id` and relevant indexes/relations.
- No dependency, environment variable, Prisma schema, or application architecture changes are needed for this story.

## Residual Notes

- This validation intentionally did not implement Story 2.2 application code.
- No lint, test, or typecheck was run because only BMAD story documentation and this validation report changed.
- Later stories must replace the inline placeholders with real route modules or handlers as their scopes require.

## Recommendation

Keep Story 2.2 in `ready-for-dev` and run `bmad-dev-story` for implementation.

