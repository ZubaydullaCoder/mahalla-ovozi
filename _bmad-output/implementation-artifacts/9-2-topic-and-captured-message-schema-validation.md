# Story 9.2 Validation Record

**Story:** Topic and Captured Message Schema

**Validated:** 2026-07-19

**Result:** PASS — ready for development

## Readiness Verdict

Story 9.2 is sufficiently complete, internally consistent, and aligned with the
current planning artifacts and repository conventions to proceed through the
BMAD Dev Story workflow. No unresolved implementation blocker remains in the
story specification.

## Validated Decisions

- Scope is additive: existing legacy tables and data remain intact.
- Topic categories are an equal, unique set represented by a join model and a
  named enum.
- Captured messages have explicit processing, disposition, retry, expiry,
  promotion, and replay metadata.
- Edited Telegram messages are ignored for the MVP, with defensive message
  uniqueness defined at the database boundary.
- Direct compound Mahalla relations enforce valid district/mahalla pairs for
  both topics and captured messages, including unassigned messages.
- Compound topic, promotion-trigger, and anchor relations prevent cross-scope
  links and require an anchor to be a member of its exact topic.
- Partial-index predicates, database check constraints, and rollback shape are
  explicit implementation requirements.
- Schema integration tests have a dedicated serial configuration and a guarded
  disposable-database runner that must reject unsafe database targets before
  invoking Prisma.
- The default test suite remains isolated from destructive schema integration
  tests; `pnpm test:schema` is the explicit opt-in command.

## Quality Review

- **Maintainability:** Schema responsibilities, relation behavior, verification
  commands, rollback expectations, and owned files are explicit.
- **Modularity and separation of concerns:** Schema definition, migration,
  guarded test orchestration, integration tests, and later business workflows
  are separated.
- **DRY:** Existing `Mahalla @@unique([id, district_id])` and relational
  constraints are reused instead of duplicating application-only scope checks.
- **Security and privacy:** Cross-scope writes are rejected by the database;
  test guards prohibit development-target reuse and credential logging.
- **Reliability:** Cardinality, uniqueness, lifecycle checks, scope mismatch,
  anchor membership, retention indexes, and rollback are covered by focused
  acceptance tests.
- **Current engineering practice:** The story uses explicit database
  invariants, generated migrations, isolated integration testing, typed enums,
  partial indexes for queue/retention paths, and application-owned purge
  orchestration.

## Evidence Checked

- Canonical Story 9.2 acceptance criteria, tasks, development notes, file list,
  and rollback reference.
- Epic 9 requirements, architecture scope/retention rules, and current Prisma
  schema conventions.
- Current `Mahalla @@unique([id, district_id])` compound key and the repository's
  existing district/mahalla consistency migration.
- Story/tracker lifecycle consistency.
- Deterministic stale-reference and required-decision checks.
- `pnpm exec prisma validate` against the current pre-implementation baseline.
- `git diff --check`.

## Verification Boundary

This is a story-artifact readiness validation, not implementation acceptance.
The proposed models, migration, generated client, and schema integration tests
do not exist yet. Their correctness must be proven during implementation using
all commands and database cases required by the story. Baseline Prisma
validation confirms only that the repository's current schema is valid before
development begins.

## Next Workflow

Run **BMAD Dev Story** for
`_bmad-output/implementation-artifacts/9-2-topic-and-captured-message-schema.md`.
