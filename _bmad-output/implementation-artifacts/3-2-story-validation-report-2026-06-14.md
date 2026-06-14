# Story 3.2 Validation Report

Date: 2026-06-14

Story: `3-2-signals-api-get-api-signals-endpoint.md`

Decision at validation time: Changes required before dev implementation.

Patch status: Addressed in `3-2-signals-api-get-api-signals-endpoint.md` on 2026-06-14.

Current recommendation: Story 3.2 may proceed to dev implementation after user review of the patched story.

## Summary

Story 3.2 is directionally correct and aligned with Epic 3, the architecture API contract, the existing `/api/signals` protected stub, and the current server stack. It should not proceed to dev implementation as written because several details would let the dev agent produce code that compiles on the happy path but fails acceptance criteria or hides data-quality problems.

## Critical Issues

1. Missing route-level tests for AC-4, AC-5, and AC-6.
   The story's AC-7 requires tests for explicit `from`/`to` handling and district scoping, but Task 5 only asks for `mapper.test.ts` and `query.test.ts`. Add `apps/server/src/signals/index.test.ts` using Supertest and mocked `querySignals` to verify:
   - authenticated `GET /api/signals` defaults to UTC+5 today range
   - explicit `from` and `to` are passed through
   - only one of `from`/`to` returns 400
   - invalid dates return 400
   - `districtId` is read from `req.session.districtId`, ignoring query/body
   - unauthenticated requests return 401 when mounted after `requireAuth`

2. Date range validation is underspecified.
   The sample handler converts `req.query` with `String(rawFrom)` and `new Date(...)`. This accepts non-string query shapes ambiguously and can allow weak date parsing behavior. The story should require single string query values, strict enough ISO 8601 parsing, and `from <= to`; otherwise return 400.

3. Mapper union casts rely on a non-existent DB constraint.
   The story says `textSource` and `category` can be cast because a DB constraint ensures valid values. Current migrations define these as `VARCHAR` without CHECK constraints. The story should either remove that claim and require defensive runtime validation in `mapSignalRow`, or add a database constraint in a separate approved story. For this story, the lower-scope fix is mapper validation that throws on corrupt `text_source` or `category`, with the route logging and returning 500.

4. The test examples do not cover the complete API response contract.
   AC-2 requires absent optionals to be `null`, ISO UTC strings, exact camelCase shape, and no `undefined`. The mapper test should assert the full object with `toEqual`, include `shortLabel`, and explicitly test null normalization for every optional field: `senderDisplayName`, `senderUsername`, `matchedKeyword`, `shortLabel`, and `telegramMessageUrl`.

## Should Fix Before Dev

5. Add deterministic ordering for equal timestamps.
   The query sorts by `telegram_timestamp` desc only. Add a secondary `id: 'desc'` order to make newest-first deterministic when multiple messages share the same Telegram timestamp.

6. Make route testability explicit.
   The story should state that `signalsRouter` can be tested by mounting it in a small Express test app after `requireAuth`, matching the existing auth middleware test pattern. Mock `querySignals` and `logger`; do not hit the real DB in route tests.

7. Clarify Prisma payload type import.
   The generated Prisma 7 client does expose model payload types through the `Prisma` namespace, so `Prisma.SignalMessageGetPayload` is acceptable in this repo. Keep the generated-client import path as `../generated/prisma/client.js`; do not import from `@prisma/client`.

8. Clarify URL builder edge handling.
   Add tests for a chat ID without the `-100` prefix and for the minimal invalid `-100n` internal ID case. The story already mentions the non-supergroup case in implementation notes, but AC-7 omits it.

## Verified Alignment

- Existing protected stub is exactly at `apps/server/src/web/index.ts` after `app.use('/api', requireAuth)`.
- `apps/server/src/shared/types.ts` already defines the target `Signal` interface.
- Prisma schema has `SignalMessage` and `Mahalla.telegram_chat_id` as expected.
- Architecture requires unwrapped arrays, camelCase JSON, null optionals, UTC ISO dates, session-only district scoping, and Telegram URL mapping in `signals/mapper.ts`.
- Current docs checks confirm the story's broad stack assumptions: Prisma 7 generated-client imports use generated `/client`, Express middleware order is registration order, and Vitest date tests should use fake timers with cleanup.

## Recommendation

Do not start `bmad-dev-story` yet. First patch the story to add the route test task, stricter date validation, mapper enum validation or corrected DB-constraint language, and deterministic ordering. After those edits, this story is suitable to proceed to dev implementation.

## Sources Reviewed

- `_bmad-output/implementation-artifacts/3-2-signals-api-get-api-signals-endpoint.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/planning-artifacts/architecture.md`
- `apps/server/src/web/index.ts`
- `apps/server/src/shared/types.ts`
- `apps/server/src/auth/middleware.ts`
- `apps/server/src/shared/session.d.ts`
- `apps/server/src/shared/db.ts`
- `apps/server/src/auth/*.test.ts`
- `apps/server/src/classifier/*.test.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**/*.sql`
- Prisma docs via Context7: `/prisma/web`
- Express docs via Context7: `/expressjs/express/4_21_2`
- Vitest docs via Context7: `/vitest-dev/vitest/v3_2_4`
