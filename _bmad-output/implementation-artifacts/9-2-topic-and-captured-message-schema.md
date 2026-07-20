# Story 9.2: Topic and Captured-Message Schema

Status: done

## Story

As a **developer**,
I want additive topic-oriented storage with enforceable source and membership integrity,
so that later pipeline stories can group messages safely without rewriting unreliable legacy history.

## Acceptance Criteria

1. **Migration applied, schema generated**
   - Given the new Prisma migration is applied
   - When the generated client and database schema are inspected
   - Then a `Topic` model stores district/mahalla scope, grounded Uzbek Cyrillic summary, first/latest activity timestamps, nullable anchor `CapturedMessage` reference, summary/model/version metadata, an optimistic-concurrency version field, and created/updated timestamps.
   - And topic categories are stored as a unique equal non-empty set supporting `water`, `electricity`, `gas`, and `waste` without a primary-category field. (Note: Non-emptiness is validated at transaction commit in Story 9.5, not at database schema validation).
   - And a `CapturedMessage` model stores Telegram update/chat/message identity, optional reply-to chat/message identity, district/mahalla, sender snapshot (display name and username) and stable sender identity when available, nullable text (to support 24-hour text purge), `text | caption` text-source provenance, Telegram timestamp, processing state, nullable final disposition, nullable final disposition timestamp (`final_disposition_at`), nullable topic membership, retry/next-attempt/last-error/dead-letter metadata, text and disposition expiration timestamps, and replay/promotion audit fields.
   - And database guarantees enforce unique Telegram update identity, defensive unique `(telegram_chat_id, telegram_message_id)` identity, and zero-or-one topic membership per captured message.
   - And district/mahalla relational constraints prevent cross-scope topic, captured-message, or promotion-trigger creation.
   - And the schema enforces or safely validates one active monitored Telegram group per mahalla (via the existing `@unique` constraint on `Mahalla.telegram_chat_id`).
   - And indexes support chronological oldest-first queue reads per mahalla, irrelevant/dead-letter expiry, topic activity/category queries, and retention purge.
   - And legacy `raw_messages` and `signal_messages` remain intact; this story is additive only — no data migration or conversion.

2. **Topic model**
   - `Topic` has: `id` (PK), `district_id`, `mahalla_id`, `summary` (Uzbek Cyrillic text), `summary_model`, `summary_version`, `first_activity_at`, `latest_activity_at`, `anchor_captured_message_id` (nullable FK to `CapturedMessage`), `version` (integer for optimistic concurrency, default 0), `created_at`, `updated_at`.
   - No `primary_category`, `status`, `assignment`, `severity`, `resolution`, or `citizen_response` fields exist on `Topic`.
   - `Topic` belongs to a `Mahalla` (and transitively to a `District`) through `mahalla Mahalla @relation(fields: [mahalla_id, district_id], references: [id, district_id], onDelete: Restrict)`. This compound relation ensures the selected mahalla belongs to the stored district.
   - Enforce cross-scope protection: `Topic` must declare `@@unique([id, district_id, mahalla_id])` so that child models can relate to it using compound keys verifying district and mahalla scope.

3. **Equal topic categories**
   - A `TopicCategory` join model stores `topic_id` and `category` (`TopicCategoryValue` enum: `water | electricity | gas | waste`).
   - A unique constraint on `(topic_id, category)` prevents duplicate categories per topic.
   - No ordering or primary marker exists; all categories are equal.
   - Referencing relation: `topic Topic @relation(fields: [topic_id], references: [id], onDelete: Cascade)` — deleting a topic cascades to delete its categories.
   - Indexes exist to efficiently support per-lane (`category`) queries and evidence-purge regeneration.

4. **CapturedMessage model**
   - `CapturedMessage` has:
     - `id` (PK)
     - `telegram_update_id` (unique)
     - `telegram_chat_id` (BigInt)
     - `telegram_message_id` (Int, nullable)
     - `reply_to_chat_id` (BigInt, nullable)
     - `reply_to_message_id` (Int, nullable)
     - `district_id`
     - `mahalla_id`
     - `sender_stable_id` (Telegram user_id as BigInt, nullable)
     - `sender_display_name` (VarChar(300), nullable)
     - `sender_username` (VarChar(100), nullable)
     - `text` (String, nullable — text of the message, set to `null` on text-purge)
     - `text_source` (`text | caption`, VarChar(10))
     - `telegram_timestamp` (DateTime)
     - `processing_state` (enum: `ProcessingState` containing `queued`, `processing`, `retry`, `dead_letter`, `complete`)
     - `final_disposition` (nullable enum: `FinalDisposition` containing `new_topic`, `attached`, `irrelevant`)
     - `final_disposition_at` (DateTime, nullable)
     - `topic_id` (nullable FK to `Topic`, part of the compound key)
     - `attempt_count` (Int, default 0)
     - `next_retry_at` (DateTime, nullable)
     - `last_error` (Text, nullable)
     - `dead_lettered_at` (DateTime, nullable)
     - `text_expires_at` (DateTime, nullable — set when `irrelevant` to `final_disposition_at + 24 hours`)
     - `disposition_expires_at` (DateTime, nullable — set when `irrelevant` to `final_disposition_at + 14 days`)
     - `promoted_from_irrelevant_at` (DateTime, nullable — audit: when an irrelevant message was promoted)
     - `promotion_triggered_by_id` (nullable FK to `CapturedMessage`)
     - `replay_attempt_at` (DateTime, nullable)
     - `replay_audit_note` (Text, nullable)
     - `created_at`, `updated_at`
   - Relational scope constraints (Prevent cross-scope leakage):
     - `mahalla Mahalla @relation(fields: [mahalla_id, district_id], references: [id, district_id], onDelete: Restrict)` — independently enforces a valid district/mahalla pair while `topic_id` is null.
     - `topic Topic? @relation("TopicMembers", fields: [topic_id, district_id, mahalla_id], references: [id, district_id, mahalla_id], onDelete: Restrict)` — a message can only belong to a topic matching its district and mahalla scope. `onDelete: Restrict` prevents PostgreSQL from attempting a composite `SetNull` which would fail because `district_id` and `mahalla_id` are required (non-nullable) fields.
     - `promotionTriggeredBy CapturedMessage? @relation("PromotionTrigger", fields: [promotion_triggered_by_id, district_id, mahalla_id], references: [id, district_id, mahalla_id], onDelete: Restrict)` — self-referential trigger relation must match district and mahalla.
     - To support these compound relations, `CapturedMessage` must declare `@@unique([id, district_id, mahalla_id])`.
     - To support the anchor relation's exact referenced tuple, `CapturedMessage` must also declare `@@unique([id, topic_id, district_id, mahalla_id])`.
     - **Anchor topic membership constraint:** To guarantee at the database level that a Topic's anchor message is a member of that exact Topic, the `Topic.anchorMessage` relation is mapped as:
       `anchorMessage CapturedMessage? @relation("TopicAnchor", fields: [anchor_captured_message_id, id, district_id, mahalla_id], references: [id, topic_id, district_id, mahalla_id], onDelete: Restrict)`
       This maps `Topic.id` directly to `CapturedMessage.topic_id`, ensuring the database rejects any anchor message that does not belong to the topic itself.

5. **Defensive message uniqueness & Edited-message semantics**
   - Source of truth: `mahallas.telegram_chat_id` `@unique` column.
   - Edited-messages decision: For the MVP, Telegram `edited_message` updates are ignored. The initial message creation is captured, and duplicate message IDs from edited events are discarded.
   - To enforce this policy at the database level, define `@@unique([telegram_chat_id, telegram_message_id])` on `CapturedMessage`. Note: since `telegram_message_id` is nullable (e.g. for edge-case intake anomalies), this unique constraint is enforced only when `telegram_message_id` is non-null.

6. **Index coverage**
   - `CapturedMessage` indexes:
     - `(district_id, mahalla_id, processing_state, telegram_timestamp, id)` — chronological per-mahalla queue reads
     - `(topic_id, telegram_timestamp, id)` — evidence listing queries
     - `(district_id, processing_state, next_retry_at)` — retry queue reads
     - `(text_expires_at)` where `final_disposition = 'irrelevant'` — partial index for text expiry purge
     - `(disposition_expires_at)` where `final_disposition = 'irrelevant'` — partial index for metadata expiry purge
     - `(dead_lettered_at)` where `processing_state = 'dead_letter'` — partial index for dead-letter purge
     - `(district_id, telegram_timestamp)` — retention window queries
   - `Topic` indexes:
     - `(district_id, mahalla_id, latest_activity_at)` — API time-range queries
     - `(district_id, latest_activity_at)` — cross-mahalla sorted listing
   - `TopicCategory` indexes:
     - `(category, topic_id)` — per-lane topic listing
   - To support partial indexes in Prisma, the generator block must declare the `"partialIndexes"` preview feature and use explicit predicates such as `where: raw("\"final_disposition\" = 'irrelevant'")` and `where: raw("\"processing_state\" = 'dead_letter'")`.

7. **Rollback/rehearsal guidance documented**
   - Prefer `prisma migrate dev --create-only`, inspect SQL, then apply. If
     unrelated runtime-managed schema drift would require a destructive reset,
     generate the migration with `prisma migrate diff` against a guarded shadow
     database and apply it with `prisma migrate deploy`; never reset the
     development database to satisfy this story.
   - Rollback down-migration SQL is documented at the bottom of this story.

8. **Focused schema tests pass**
   - Tests confirm: `Topic` insert, `CapturedMessage` insert, `unique telegram_update_id` constraint, `(telegram_chat_id, telegram_message_id)` unique constraint, many messages to one topic cardinality, relational cross-scope constraints (cannot set `topic_id` or `anchor_captured_message_id` from a different mahalla/district or a different topic membership), and database-enforced lifecycle constraints.
   - **Isolated test-database procedure:** To prevent accidental data loss or dev database resets:
     - Tests must parse the database URL from `TEST_DATABASE_URL`.
     - Reject if normalized `TEST_DATABASE_URL` and `DATABASE_URL` resolve to the same host, port, and database.
     - Extract the database name from the URL pathname and verify it ends strictly with `_test` or `_disposable`. If not, throw and abort.
     - `scripts/run-schema-integration-tests.ts` performs these checks before starting any Prisma subprocess, compares normalized host/port/database targets rather than raw URL strings, and never logs credentials.
     - Only after the guard passes, the wrapper injects `DATABASE_URL=TEST_DATABASE_URL` into child processes, runs `prisma migrate deploy`, and runs the dedicated serial Vitest schema project.
     - The default `pnpm test` excludes the real-database schema test; `pnpm test:schema` invokes the guarded wrapper so a missing test database cannot silently skip the required integration coverage.
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, and guarded `pnpm test:schema` pass.

## Tasks / Subtasks

- [x] **Task 1: Design the exact Prisma schema additions** (AC: 1–6)
  - [x] Update `schema.prisma` generator client block to include `previewFeatures = ["partialIndexes"]`.
  - [x] Define `enum ProcessingState` containing: `queued`, `processing`, `retry`, `dead_letter`, `complete`.
  - [x] Define `enum FinalDisposition` containing: `new_topic`, `attached`, `irrelevant`.
  - [x] Define `enum TopicCategoryValue` containing: `water`, `electricity`, `gas`, `waste`.
  - [x] Add `Topic` model with required fields, compound unique constraint `@@unique([id, district_id, mahalla_id])`, and relations/indexes.
  - [x] Add `TopicCategory` join model using `TopicCategoryValue` (cascade delete on topic).
  - [x] Add `CapturedMessage` model with all required fields, including nullable `text`, `final_disposition_at`, `@@unique([id, district_id, mahalla_id])`, `@@unique([id, topic_id, district_id, mahalla_id])`, and `@@unique([telegram_chat_id, telegram_message_id])`.
  - [x] Map direct compound Mahalla relations for both `Topic` and `CapturedMessage` on `[mahalla_id, district_id] -> Mahalla.[id, district_id]` with `onDelete: Restrict`.
  - [x] Map the remaining relations exactly with referential actions (`onDelete: Restrict` for composite keys sharing required columns to prevent runtime composite `SetNull` failures, and named relation bindings `TopicMembers`, `TopicAnchor`, `PromotionTrigger`).
  - [x] Add refined indexes per AC6, using explicit `raw(...)` predicates for each partial index.
  - [x] Add back-relations to existing `Mahalla` in `schema.prisma` (topics, captured messages); confirm this is a Prisma-only change that doesn't modify the database table `mahallas`.
  - [x] Run `prisma validate` to verify schema correctness.

- [x] **Task 2: Create and apply migration** (AC: 1, 7)
  - [x] Generate the migration SQL safely. `migrate dev --create-only` was
    blocked by unrelated runtime-managed `sessions` drift, so use
    `prisma migrate diff` against the guarded shadow database rather than
    accepting a destructive reset.
  - [x] Manually inspect the SQL migration to verify table creations, compound constraints, partial indexes, FK actions, enums, check constraints (`attempt_count >= 0`, paired reply IDs), and that no legacy columns are dropped.
  - [x] Apply the inspected migration with `pnpm exec prisma migrate deploy`.
  - [x] Run `pnpm exec prisma generate`.

- [x] **Task 3: Verify legacy tables are untouched** (AC: 1)
  - [x] Confirm `raw_messages`, `signal_messages`, `keywords`, `batch_health`, `pipeline_events`, `mahallas`, `districts`, `users` are physically unchanged in the database.
  - [x] Validate by generating a schema-diff or running catalog queries against pg database metadata comparing baseline structure to the current structure, ensuring no legacy tables were modified.

- [x] **Task 4: Write focused schema integration tests** (AC: 8)
  - [x] Create `apps/server/src/topics/schema.integration.test.ts`.
  - [x] Add `vitest.schema.config.ts` as a dedicated single-worker project for the real-database schema test, and exclude this file from the default node-test project in `vitest.config.ts`.
  - [x] Create `scripts/run-schema-integration-tests.ts`; before any child process starts, parse and normalize `TEST_DATABASE_URL`, reject database names not ending in `_test` or `_disposable`, reject the same normalized host/port/database target as `DATABASE_URL`, then inject the test URL as child `DATABASE_URL`.
  - [x] Add `test:schema` to `package.json` to run the guarded wrapper; document `TEST_DATABASE_URL` in `.env.example`.
  - [x] Have the wrapper run `prisma migrate deploy` against the guarded disposable database, then the serial schema-test project. Do not run `migrate reset`, seed production-like data, or log either connection URL.
  - [x] Test database-enforced lifecycle constraints: enums enforce valid options; custom DB checks throw on `attempt_count < 0` or half-filled reply IDs (e.g. `reply_to_chat_id` set but `reply_to_message_id` is null).
  - [x] Test: multiple `CapturedMessage` rows referencing the same `Topic` succeeds (many-to-one).
  - [x] Test: inserting a `Topic` whose `mahalla_id` belongs to a different `district_id` throws a foreign key constraint violation.
  - [x] Test: inserting an unassigned `CapturedMessage` (`topic_id = null`) whose `mahalla_id` belongs to a different `district_id` throws a foreign key constraint violation.
  - [x] Test: cross-scope constraint violation — inserting a `CapturedMessage` referencing a `Topic` with a different `mahalla_id` or `district_id` throws a foreign key constraint violation.
  - [x] Test: a valid same-topic anchor succeeds.
  - [x] Test: anchor topic membership constraint — inserting a `Topic` whose `anchor_captured_message_id` points to a `CapturedMessage` with a different `topic_id` (or no `topic_id`) throws a FK violation.
  - [x] Test: duplicate `telegram_update_id` raises a unique constraint error.
  - [x] Test: duplicate `(telegram_chat_id, telegram_message_id)` (defensive message uniqueness) raises a unique constraint error.
  - [x] Test: two `Mahalla` rows cannot share one `telegram_chat_id`.
  - [x] Test: `TopicCategory` duplicates are rejected, and categories cascade delete with the topic.
  - [x] Clean only the new story tables and explicitly created district/mahalla fixtures between tests.
  - [x] Run `pnpm test:schema` and verify passing status.

- [x] **Task 5: Run all required verification checks** (AC: 8)
  - [x] `pnpm exec prisma validate`
  - [x] `pnpm exec prisma generate`
  - [x] `pnpm exec prisma migrate status`
  - [x] `pnpm lint`
- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm test:schema`

### Review Findings

- [x] [Review][Patch] [High] Exclude the schema runner from the default Vitest project so `pnpm test` cannot execute migrations or real-database cleanup [vitest.config.ts:11]
- [x] [Review][Patch] [High] Preserve Vitest's standard exclusions; the custom `exclude` currently admits dependency tests and makes the required `pnpm test` gate fail [vitest.config.ts:16]
- [x] [Review][Patch] [High] Replace unsafe `ON UPDATE CASCADE` behavior on compound anchor and promotion integrity relations with restrictive update semantics [prisma/schema.prisma:240]
- [x] [Review][Patch] [High] Replace the rollback reference's non-existent truncated FK names and rehearse a rollback that actually drops the anchor dependency [9-2-topic-and-captured-message-schema.md:319]
- [x] [Review][Patch] [Medium] Add the required invalid-enum, promotion-trigger scope, and reverse half-filled reply-ID integration cases [apps/server/src/topics/schema.integration.test.ts:348]
- [x] [Review][Patch] [Medium] Build genuine two-district fixtures and assert expected database constraints instead of accepting any thrown error [apps/server/src/topics/schema.integration.test.ts:159]
- [x] [Review][Patch] [Medium] Make fixture cleanup target only records created by this suite and unlink promotion-trigger self-references before deletion [apps/server/src/topics/schema.integration.test.ts:41]
- [x] [Review][Patch] [Medium] Sanitize malformed database-URL failures so the guard cannot expose a rejected credential-bearing URL [scripts/run-schema-integration-tests.ts:24]
- [x] [Review][Patch] [Medium] Reconcile the checked migration/rehearsal tasks with the different `migrate diff` and `migrate deploy` path actually executed [9-2-topic-and-captured-message-schema.md:251]
- [x] [Review][Patch] [Medium] Restore lifecycle tracking to review/in-progress until the failing required gate and review findings are resolved [sprint-status.yaml:139]

## Dev Notes

### Scope Boundary

This story is **purely additive schema work**. It does not implement intake, drain, retrieval, triage, persistence, APIs, or UI.

### In-Place vs Versioned Edits (Edited-message Semantics)

Telegram `edited_message` updates are ignored for the MVP to preserve source message identity and prevent versioning noise on the dashboard. The `@@unique([telegram_chat_id, telegram_message_id])` database constraint enforces this behavior at the database layer.

### Cross-Scope & Anchor Protection

- `Topic` defines `@@unique([id, district_id, mahalla_id])`.
- `CapturedMessage` defines `@@unique([id, district_id, mahalla_id])`.
- `CapturedMessage` also defines `@@unique([id, topic_id, district_id, mahalla_id])` as the exact referenced key for the anchor-membership relation.
- `Topic` and `CapturedMessage` each link `[mahalla_id, district_id]` to `Mahalla.[id, district_id]`, using the existing `Mahalla @@unique([id, district_id])`, so invalid district/mahalla pairs are rejected even before a captured message is assigned to a topic.
- Relations link on `[topic_id, district_id, mahalla_id]` to guarantee that all messages inside a topic share the exact same mahalla/district scope as the topic itself.
- `Topic.anchorMessage` links `[anchor_captured_message_id, id, district_id, mahalla_id]` to `[id, topic_id, district_id, mahalla_id]` on `CapturedMessage` to guarantee at the database level that the anchor message is a member of the topic it anchors.
- Direct compound Mahalla relations use `onDelete: Restrict`; the authorized Mahalla-deletion workflow must delete dependent topic/evidence rows in an explicit transaction (Story 9.6) instead of relying on a multi-path database cascade.

### Test Environment Guard

To prevent accidental reset of the development or production database:
```ts
export function parseDatabaseTarget(rawUrl: string) {
  try {
    const url = new URL(rawUrl)
    return {
      host: url.hostname.toLowerCase(),
      port: url.port || "5432",
      database: decodeURIComponent(url.pathname.slice(1)),
    }
  } catch {
    throw new Error("Invalid database URL")
  }
}

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) throw new Error("TEST_DATABASE_URL must be defined")
const testTarget = validateSchemaTestTarget(testUrl, process.env.DATABASE_URL)
```

The pure parsing and validation guard lives in `scripts/schema-test-guard.ts`
with focused unit tests. `scripts/run-schema-integration-tests.ts` invokes it
before spawning Prisma or Vitest. Malformed URLs produce a sanitized error that
never echoes their credential-bearing input. The wrapper passes
`{ ...process.env, DATABASE_URL: testUrl }` only to its child processes, runs
`pnpm exec prisma migrate deploy`, then runs the dedicated serial schema-test
configuration. The schema test itself must never run migration or reset
commands.

### Lifecycle Invariants

- **Database-enforced now (via Enums & check constraints in migrations):**
  - `processing_state` must be one of: `queued`, `processing`, `retry`, `dead_letter`, `complete`.
  - `final_disposition` must be one of: `new_topic`, `attached`, `irrelevant`.
  - `attempt_count >= 0`.
  - `reply_to_chat_id` and `reply_to_message_id` must be either both null or both non-null.
- **Application-enforced later (Story 9.5):**
  - `complete` processing state implies non-null disposition.
  - `irrelevant` disposition implies null topic membership.

### References

- [Source: `_bmad-output/planning-artifacts/architecture.md#5-Data-Architecture`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#5.1-Topic`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#5.2-Equal-topic-categories`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#5.3-CapturedMessage`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#5.4-Source-and-membership-guarantees`]
- [Source: `_bmad-output/planning-artifacts/architecture.md#5.5-Additive-migration-and-cutover`]
- [Source: `_bmad-output/planning-artifacts/epics.md#Story-9.2-Topic-and-Captured-Message-Schema`]
- [Source: `docs/runbooks/data-retention-policy.md#2-Retention-Schedule`]
- [Source: `prisma/schema.prisma`]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6 (Thinking)

### Debug Log References

- Used `prisma migrate diff --from-migrations --to-schema --script` to generate migration SQL, bypassing drift detection caused by the untracked `sessions` table (created by connect-pg-simple at runtime, outside Prisma migrations).
- Applied migration via `prisma migrate deploy` instead of `migrate dev` to avoid interactive drift-reset prompt.
- Removed `shadowDatabaseUrl` from `prisma.config.ts` after SQL generation — it conflicted with the guard script injecting TEST_DATABASE_URL as DATABASE_URL for child processes.
- Fixed `afterEach` FK cycle: when anchor is set, `deleteMany` on `captured_messages` fails because topic FK references it. Solution: null anchor first, then null topic_id on messages, then delete.
- Test `beforeAll` made idempotent to handle leftover fixtures from failed previous runs.

### Implementation Plan

1. Created test database `mahalla_ovozi_test` and added `TEST_DATABASE_URL` to `.env` and `.env.example`.
2. Updated `prisma/schema.prisma` with `previewFeatures = ["partialIndexes"]`, 3 enums, `Topic`, `TopicCategory`, `CapturedMessage` models, all compound relations, and partial indexes using `raw()` syntax.
3. Generated SQL via `prisma migrate diff`, manually added `CHECK` constraints, created migration file `20260720031500_add_topic_captured_message_schema/migration.sql`.
4. Applied migration via `prisma migrate deploy` and regenerated Prisma client.
5. Verified all 8 legacy tables untouched via DB metadata queries.
6. Created `scripts/run-schema-integration-tests.ts` with full guard (name suffix, same-DB check, no credential logging).
7. Created `vitest.schema.config.ts` (serial, single worker).
8. Excluded `schema.integration.test.ts` from `vitest.config.ts` node-tests project.
9. Added `test:schema` to `package.json`.
10. Wrote 22 integration tests covering all AC8 scenarios.
11. All verification checks passed: `prisma validate`, `migrate status`, `lint`, `typecheck`, `test`, `test:schema`.
12. Review fixes isolated the schema runner from default tests, restored
    Vitest's standard exclusions, added sanitized URL guards, introduced
    genuine two-district fixtures, and expanded schema coverage to 29 tests.
13. Added and applied
    `20260720044000_restrict_compound_relation_updates`, then rehearsed the
    documented down SQL and both up migrations inside a rolled-back disposable
    database transaction.

### Completion Notes List

- ✅ Schema validated: `prisma validate` passes
- ✅ Migration applied: `20260720031500_add_topic_captured_message_schema`
- ✅ Prisma client regenerated
- ✅ All 8 legacy tables verified untouched
- ✅ Guard script rejects non-`_test`/`_disposable` DB names and same-DB target
- ✅ 22 schema integration tests pass: Topic insert, CapturedMessage insert, many-to-one, cross-scope FK violations (mahalla and district), anchor membership constraint, unique constraints (telegram_update_id, chat+message pair, Mahalla chat_id), TopicCategory cascade, DB check constraints (attempt_count, paired reply IDs)
- ✅ `pnpm lint` clean
- ✅ `pnpm typecheck` clean
- ✅ `pnpm test` passes (824/824 tests; 67/67 files)
- ✅ `pnpm test:schema` 29/29 pass
- ✅ Rollback/down and base-plus-corrective up SQL rehearsal passes inside a
  rolled-back transaction on the guarded disposable database

### File List

- `prisma/schema.prisma` (MODIFIED)
- `prisma/migrations/20260720031500_add_topic_captured_message_schema/migration.sql` (NEW)
- `prisma/migrations/20260720044000_restrict_compound_relation_updates/migration.sql` (NEW)
- `apps/server/src/generated/prisma/` (regenerated; never hand-edit)
- `apps/server/src/topics/schema.integration.test.ts` (NEW)
- `scripts/schema-test-guard.ts` (NEW)
- `scripts/schema-test-guard.test.ts` (NEW)
- `scripts/run-schema-integration-tests.ts` (NEW)
- `vitest.schema.config.ts` (NEW)
- `vitest.config.ts` (MODIFIED)
- `package.json` (MODIFIED)
- `.env` (MODIFIED — added TEST_DATABASE_URL)
- `.env.example` (MODIFIED — documented TEST_DATABASE_URL)
- `prisma.config.ts` (unchanged — shadowDatabaseUrl added and removed during SQL generation)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (MODIFIED)
- `_bmad-output/implementation-artifacts/9-2-topic-and-captured-message-schema.md` (MODIFIED)

## Change Log

- 2026-07-19: Story 9.2 specification created.
- 2026-07-19: Story 9.2 patched to resolve 12 blocking findings and referential corrections.
- 2026-07-19: Story 9.2 patched to address composite SetNull runtime failures, anchor-membership validation, edited-message policy validation, database-test URL parsing, enums, checks, and custom rollback SQL drop statements.
- 2026-07-19: Story 9.2 finalized with the exact anchor target key, guarded pre-command schema-test runner, named category enum rollback, and complete implementation file list.
- 2026-07-19: Final validation added direct compound Mahalla scope relations and mismatch tests; story passed the readiness gate and moved to `ready-for-dev`.
- 2026-07-20: Story 9.2 implemented by Claude Sonnet 4.6 (Thinking). All 5 tasks complete. `pnpm test:schema` 22/22 pass. Status → review.
- 2026-07-20: Code-review fixes applied. Default tests are database-isolated,
  compound update cascades are restricted, rollback SQL is rehearsed, schema
  coverage is 29/29, and all required gates pass. Status → done.

---

## Rollback Reference

The down-migration must follow this shape. After the migration is generated,
replace the constraint names below with the exact generated names and rehearse
the down/up sequence only against the guarded disposable test database:

```sql
ALTER TABLE "captured_messages" DROP CONSTRAINT IF EXISTS "captured_messages_topic_id_district_id_mahalla_id_fkey";
ALTER TABLE "captured_messages" DROP CONSTRAINT IF EXISTS "captured_messages_promotion_triggered_by_id_district_id_ma_fkey";
ALTER TABLE "topics" DROP CONSTRAINT IF EXISTS "topics_anchor_captured_message_id_id_district_id_mahalla_i_fkey";
ALTER TABLE "topic_categories" DROP CONSTRAINT IF EXISTS "topic_categories_topic_id_fkey";

DROP TABLE IF EXISTS "topic_categories";
DROP TABLE IF EXISTS "captured_messages";
DROP TABLE IF EXISTS "topics";

DROP TYPE IF EXISTS "ProcessingState";
DROP TYPE IF EXISTS "FinalDisposition";
DROP TYPE IF EXISTS "TopicCategoryValue";
```
