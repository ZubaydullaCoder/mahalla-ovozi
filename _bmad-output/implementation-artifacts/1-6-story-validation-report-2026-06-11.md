# Story Validation Report: 1.6 Signal Retention Purge

Date: 2026-06-11
Status: Passed after validation edits
Story file: `_bmad-output/implementation-artifacts/1-6-signal-retention-purge.md`

## Validation Scope

- Checked Story 1.6 against Epic 1.6 acceptance criteria, PRD FR27, architecture data-retention and scheduler guidance, current Prisma schema, current server scheduler wiring, Story 1.5 implementation state, sprint status, and current `node-cron` scheduling documentation.
- Verified workflow state: Stories 1.1-1.5 are `done`; Story 1.6 is marked `ready-for-dev`; this is the final Epic 1 implementation story before retrospective.
- Verified current code state: `node-cron` is installed, `apps/server/src/web/index.ts` already owns scheduler registration, `apps/server/src/classifier/index.ts` is the classifier public API, and `SignalMessage` currently lacks `@@index([created_at])`.

## Applicability Result

Story 1.6 is applicable in the current codebase and is the correct next Epic 1 story.

After the validation edits below, the story is ready for `bmad-dev-story`.

## Corrections Applied

1. Made the 03:00 UTC cron behavior explicit.

   The story now requires the retention cron to pass `{ timezone: 'UTC' }` to `cron.schedule('0 3 * * *', ...)`.

   Risk if not fixed: a bare node-cron schedule can run according to the host process timezone, so the job could fire at local 03:00 instead of 03:00 UTC.

2. Removed ambiguous purge error-handling guidance.

   The test guidance now requires DB failures to log `retention_purge_error` and rethrow the original error.

   Risk if not fixed: one dev agent could silently swallow purge failures while another rethrows, creating inconsistent scheduler behavior and weaker diagnostics.

3. Aligned the implementation snippet with the task wording.

   The `cutoff` calculation is now inside the `try` block so the snippet matches "wrap the entire function body in try/catch."

   Risk if not fixed: low, but the previous mismatch made the story less precise for an implementation agent.

## Confirmed Valid

- Scope is correct: only signal retention purge, no dashboard, no Ops Console, no classifier batch-health changes.
- File locations match architecture and current code: purge logic belongs in `apps/server/src/classifier/purge.ts`, is exported through `classifier/index.ts`, and is scheduled in `web/index.ts`.
- Retention field is correct per architecture: use `signal_messages.created_at`, not `telegram_timestamp`.
- Purge is correctly global across districts and mahallas; it should not resolve active district or apply district scoping.
- No concurrency lock is needed for purge because the operation is idempotent.
- Adding `@@index([created_at])` to `SignalMessage` is justified because the purge predicate filters by `created_at`.
- Generated Prisma client output is ignored by Git in this repo (`apps/server/src/generated/`), so it should be regenerated locally as needed but not added to the story's tracked file list.

## Residual Notes

- The architecture examples also show a bare `cron.schedule('0 3 * * *', ...)`; the story is now stricter than the architecture example because current node-cron behavior requires explicit timezone configuration to guarantee UTC.
- The story's expected test count says "all existing 76 tests + new purge tests"; this matches the current post-Story-1.5 test count recorded in Story 1.5.

## Verification

- Documentation validation completed against current `node-cron` docs for the `timezone` schedule option.
- Repository inspection completed for current scheduler, classifier public API, Prisma schema, migration state, and sprint status.
- No code checks were run because this validation only edited story documentation, not executable code.

## Recommendation

Keep Story 1.6 in `ready-for-dev` and run `bmad-dev-story` for implementation.

