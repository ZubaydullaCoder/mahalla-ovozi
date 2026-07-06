# Story Validation Report: 1.4 Keyword Registry & Three-Mode Filtering Pipeline

Date: 2026-06-09
Status: Passed after verification edit
Story file: `_bmad-output/implementation-artifacts/1-4-keyword-registry-and-three-mode-filtering-pipeline.md`

## Validation Scope

- Checked Story 1.4 against Epic 1.4 acceptance criteria, PRD FR21a/FR21b/FR22, architecture filtering-mode requirements, Ops Console pipeline-event expectations, current Prisma schema, current pipeline implementation, current env validation, and prior Story 1.3 learnings.
- Verified current baseline state: Story 1.3 is done, Story 1.4 is marked ready-for-dev in sprint status, and the current pipeline still has the expected Story 1.2 shape.
- Ran baseline verification checks after sandbox-related retry.

## Applicability Result

Story 1.4 is applicable in the current codebase and is the correct next Epic 1 story.

The required story-context corrections have been verified and the story is ready for `dev-story`.

## Corrections Verified

1. Make `raw_message_id` correlation mandatory for queued/written messages.

   The story currently says `raw_message_id` should be set after upsert "if available (or null if upsert returns void)." Prisma `upsert` returns the row, so the dev agent should store the result and write `raw_message_id: rawMessage.id` for `ai_full`, `keyword_gate` matched, and `shadow_compare` queued messages. `raw_message_id: null` should be reserved for `keyword_skip`, where the message is intentionally not written to `raw_messages`.

   Risk if not fixed: Ops Console event logs and downstream comparison metrics lose message-level traceability even though the data is available.

2. Add explicit query-level coverage for inactive keywords.

   The matcher signature only receives `{ phrase }`, so inactive keyword handling cannot be proven by matcher tests. The story correctly says `getActiveKeywords()` must query `is_active=true`, but it does not explicitly require a query test or an assertion on the Prisma `findMany` where clause.

   Required story correction: add `apps/server/src/keywords/query.test.ts` or an equivalent test that verifies `getActiveKeywords(districtId)` calls `prisma.keyword.findMany({ where: { district_id: districtId, is_active: true }, ... })` and returns active phrases only.

   Risk if not fixed: Acceptance Criterion 4 can be falsely marked complete while inactive DB rows still affect matching.

3. Align matcher guidance with architecture's trimmed-phrase requirement.

   Architecture test guidance requires "trimmed phrases." The story's matcher snippet only lowercases text and phrases. The matcher should trim phrases before matching, skip empty trimmed phrases, and include a test for whitespace-padded keyword phrases.

   Risk if not fixed: leading/trailing spaces in stored phrases can break matching, and empty phrases could match every message if they ever reach the matcher.

4. Remove event-type ambiguity.

   The story mentions `keyword_match`, `prefilter_pass`, and "shadow events," but the architecture/Ops event contract only defines these relevant event types: `prefilter_pass`, `keyword_match`, and `keyword_skip`.

   Verified correction:
   - `keyword_match` for any queued message with a keyword match.
   - `keyword_skip` for `keyword_gate` no-match, with `raw_message_id: null` and `reason`.
   - `prefilter_pass` for queued no-match messages in `ai_full` and `shadow_compare`, with `keywordMatched: false` and `matchedPhrase: null`.
   - Do not introduce a new `shadow_compare` event type.

## Confirmed Valid

- Story sequencing is correct: Story 1.3 is done, and Story 1.4 is next in sprint status.
- Scope is correct: no keyword CRUD routes, no seed keyword data, no Prisma schema migration, no batch-health writes during webhook intake.
- File locations are consistent with architecture: `apps/server/src/keywords/` for read-only keyword helpers and `apps/server/src/bot/filters/pipeline.ts` for mode routing.
- `FILTER_MODE` already exists and is validated in `apps/server/src/shared/env.ts`.
- Prisma schema already contains `Keyword`, `PipelineEvent`, `RawMessage`, and `SignalMessage` fields needed by this story.
- Current pipeline shape matches the story's expected update point: after F0/F1/F2/F3 and mahalla lookup, before idempotent `raw_messages` upsert.

## Verification

- `pnpm test`: passed after running outside the sandbox. Result: 3 test files, 33 tests passed.
- `pnpm exec tsc --noEmit -p apps/server/tsconfig.json`: passed after running outside the sandbox.

Initial sandbox attempts failed because Vitest/esbuild could not spawn a helper process and the local compiler command was not resolved in the sandboxed shell. The retried checks passed.

## Verification Update

- 2026-06-09: Verified that all four required corrections are present in Story 1.4.
- 2026-06-09: Tightened two residual task-list phrases so they cannot reintroduce event-type ambiguity or make `reason` appear mandatory for non-skip events.

## Recommendation

Keep Story 1.4 in `ready-for-dev` and run `bmad-dev-story`.

