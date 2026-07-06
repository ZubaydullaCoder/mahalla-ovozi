# Story Validation Report: 1.5 AI Classifier Batch Processor

Date: 2026-06-11
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/1-5-ai-classifier-batch-processor.md`

## Validation Scope

- Checked Story 1.5 against Epic 1.5 acceptance criteria, PRD FR20-F28, architecture AI classifier and scheduler requirements, current Prisma schema, current env validation, current Story 1.4 pipeline implementation, sprint status, and deferred Story 1.4 review findings.
- Verified current workflow state: Story 1.4 is done, Story 1.5 is marked `ready-for-dev`, Story 1.6 remains backlog.
- Verified current package state: `@google/genai`, `node-cron`, and `zod-to-json-schema` are not yet installed in `apps/server/package.json`, matching the story's install-first task.
- Checked current documentation for `@google/genai` structured output and `zod-to-json-schema` Zod v4 compatibility.

## Applicability Result

Story 1.5 is applicable in the current codebase and is the correct next Epic 1 story.

After the validation edits below, the story is ready for `bmad-dev-story`.

## Corrections Applied

1. Clarified Zod v4 and `zod-to-json-schema` compatibility.

   The project uses Zod v4, while `zod-to-json-schema` requires v3-compatible schema objects when used in a Zod v4 project. The story now instructs the classifier schema to import from `zod/v3` only for `apps/server/src/classifier/schema.ts`, while leaving existing env validation on Zod v4.

   Risk if not fixed: the dev agent could implement a Zod v4 schema and pass it directly to `zodToJsonSchema()`, causing broken or incorrect Gemini response schema generation.

2. Bounded the batch-health aggregation window.

   The story now requires `intake_window_to = started_at` and aggregates `pipeline_events` with `created_at >= intake_window_from AND created_at < intake_window_to`.

   Risk if not fixed: events created during the current batch could be counted in this run and then counted again in the next run because the next window starts from the previous batch's `started_at`.

3. Made batch status semantics explicit.

   The story now says `status='ok'` only when every fetched message is processed, ignored, or cleared as an idempotent duplicate. Any retry-exhausted message or batch-level failure produces `status='failed'`, writes `error_message`, and leaves failed raw messages in `raw_messages`.

   Risk if not fixed: failed AI classifications could be hidden behind an `ok` batch status, delaying dashboard health and Ops diagnostics.

4. Aligned raw message fetch ordering with existing anti-pattern guidance.

   Task 4.2 now requires `orderBy: { id: 'asc' }` for deterministic batch processing.

   Risk if not fixed: tests and logs become less stable, and retry/idempotency behavior is harder to reason about.

## Confirmed Valid

- Sequencing is correct: Story 1.5 follows the completed keyword pipeline work from Story 1.4.
- Scope is correct: no retention purge cron, no Ops trigger endpoint, no keyword CRUD, no dashboard work.
- File locations match architecture: new code belongs under `apps/server/src/classifier/`; env and web entry are the only existing files updated.
- Prisma schema already contains required `RawMessage`, `SignalMessage`, `BatchHealth`, and `PipelineEvent` fields.
- Story carries forward the Story 1.4 `COUNT(DISTINCT telegram_update_id)` requirement.
- Story correctly updates existing test env mocks after adding `AI_API_KEY` and `AI_MODEL`.
- Story correctly preserves module boundaries: `classifier/` reads `raw_messages`, writes `signal_messages` and `batch_health`, and does not modify `bot/filters/pipeline.ts` or `keywords/`.

## Residual Notes

- `pre_filter_discards` remains a documented Phase 1 limitation because structural discards are currently logged, not written to `pipeline_events`. The story keeps this field at `0` with TODO comments rather than inventing unreliable counts.
- The story file is currently present as an untracked local artifact. This report validates the file on disk, not Git tracking state.

## Verification

- Documentation validation completed with current `@google/genai` and `zod-to-json-schema` docs.
- `pnpm lint`: passed.
- `pnpm test`: passed, 65 tests.
- `pnpm exec tsc --noEmit -p apps/server/tsconfig.json`: passed.

## Recommendation

Keep Story 1.5 in `ready-for-dev` and run `bmad-dev-story`.

